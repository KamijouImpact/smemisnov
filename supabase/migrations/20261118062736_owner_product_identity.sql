-- Existing shared rows keep their IDs so historical listings remain readable.
ALTER TABLE public.category
  ADD COLUMN sme_id bigint REFERENCES public.sme(sme_id),
  DROP CONSTRAINT category_category_name_key;
CREATE UNIQUE INDEX legacy_category_name ON public.category(category_name)
WHERE sme_id IS NULL;
CREATE UNIQUE INDEX store_category_name
ON public.category(sme_id, lower(regexp_replace(btrim(category_name), '\s+', ' ', 'g')))
WHERE sme_id IS NOT NULL;

ALTER TABLE public.product
  ADD COLUMN sme_id bigint REFERENCES public.sme(sme_id),
  ADD COLUMN store_brand_name text,
  ADD COLUMN owner_identity_key text,
  ADD CONSTRAINT owner_product_identity_required CHECK ((sme_id IS NULL) = (owner_identity_key IS NULL));
CREATE UNIQUE INDEX store_product_identity ON public.product(sme_id, owner_identity_key)
WHERE sme_id IS NOT NULL;

ALTER TABLE public.product_unit
  ADD COLUMN store_barcode text,
  ADD CONSTRAINT store_barcode_format CHECK (store_barcode IS NULL OR store_barcode ~ '^[0-9]{14}$');

CREATE FUNCTION private.normalize_gtin(value text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  barcode text := regexp_replace(coalesce(value, ''), '\s+', '', 'g');
  checksum integer;
BEGIN
  IF barcode !~ '^(\d{8}|\d{12}|\d{13}|\d{14})$' THEN RETURN NULL; END IF;
  barcode := lpad(barcode, 14, '0');
  SELECT sum(substr(barcode, position, 1)::integer * CASE WHEN position % 2 = 1 THEN 3 ELSE 1 END)
  INTO checksum FROM generate_series(1, 13) AS digits(position);
  IF barcode = '00000000000000' OR (10 - checksum % 10) % 10 <> right(barcode, 1)::integer THEN
    RETURN NULL;
  END IF;
  RETURN barcode;
END
$$;
REVOKE ALL ON FUNCTION private.normalize_gtin(text) FROM public, anon, authenticated;

CREATE FUNCTION private.can_read_catalog_product(id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT (SELECT private.current_role()) = 'Administrator' OR EXISTS (
    SELECT 1 FROM public.product p WHERE p.product_id=id AND (
      (p.sme_id IS NOT NULL AND private.can_store(p.sme_id)) OR
      (p.sme_id IS NULL AND EXISTS (
        SELECT 1 FROM public.product_variation pv
        JOIN public.store_product sp USING (variation_id)
        WHERE pv.product_id=p.product_id AND private.can_store(sp.sme_id)
      ))
    )
  )
$$;

CREATE FUNCTION private.can_read_catalog_variation(id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.product_variation v WHERE v.variation_id=id
      AND private.can_read_catalog_product(v.product_id)
  )
$$;

REVOKE ALL ON FUNCTION private.can_read_catalog_product(bigint), private.can_read_catalog_variation(bigint)
FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_read_catalog_product(bigint), private.can_read_catalog_variation(bigint)
TO authenticated;

ALTER POLICY catalog_read ON public.category USING (
  CASE WHEN sme_id IS NULL THEN (SELECT private.current_role()) IN ('Administrator', 'Owner')
       ELSE private.can_store(sme_id) END
);
ALTER POLICY catalog_read ON public.product USING (private.can_read_catalog_product(product_id));
ALTER POLICY catalog_read ON public.product_variation USING (private.can_read_catalog_product(product_id));
ALTER POLICY catalog_read ON public.product_unit USING (private.can_read_catalog_variation(variation_id));

CREATE FUNCTION private.guard_product_category_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.category c WHERE c.category_id=NEW.category_id AND c.sme_id IS NOT DISTINCT FROM NEW.sme_id) THEN
    RAISE EXCEPTION 'Choose a category for this store.';
  END IF;
  RETURN NEW;
END
$$;

CREATE FUNCTION private.guard_store_product_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.product_variation v JOIN public.product p USING (product_id)
    WHERE v.variation_id=NEW.variation_id AND (p.sme_id IS NULL OR p.sme_id=NEW.sme_id)
  ) THEN
    RAISE EXCEPTION 'Choose a product that belongs to this store.';
  END IF;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION private.guard_product_category_scope(), private.guard_store_product_scope()
FROM public, anon, authenticated;
CREATE TRIGGER product_category_scope
BEFORE INSERT OR UPDATE OF category_id, sme_id ON public.product
FOR EACH ROW EXECUTE FUNCTION private.guard_product_category_scope();
CREATE TRIGGER store_product_scope
BEFORE INSERT OR UPDATE OF variation_id, sme_id ON public.store_product
FOR EACH ROW EXECUTE FUNCTION private.guard_store_product_scope();

CREATE FUNCTION private.create_store_product(a jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  store_id bigint := nullif(a->>'sme_id','')::bigint;
  product_name text;
  brand text;
  variant text;
  requested_category text;
  stock_unit text;
  pack_name text;
  condition text;
  size_value numeric;
  size_unit text;
  pack_count integer;
  barcode_input text;
  barcode text;
  identity_key text;
  category_id bigint;
  category_status text;
  chosen_product_id bigint;
  chosen_variation_id bigint;
  unit_id bigint;
  store_product_id bigint;
  price_id bigint;
BEGIN
  PERFORM private.own_store(store_id);
  IF jsonb_typeof(a) <> 'object' OR octet_length(a::text) > 12000 THEN
    RAISE EXCEPTION 'Enter valid product details.';
  END IF;

  product_name := private.required(a->>'product_name','product name');
  brand := nullif(btrim(a->>'brand'),'');
  variant := coalesce(nullif(btrim(a->>'variant'),''),'Standard');
  requested_category := coalesce(nullif(btrim(a->>'category_name'),''),'Uncategorized');
  stock_unit := private.clean(coalesce(nullif(btrim(a->>'stock_unit'),''),'piece'));
  condition := coalesce(nullif(btrim(a->>'condition'),''),'New');
  pack_count := coalesce(nullif(a->>'pack_count','')::integer,1);
  pack_name := coalesce(nullif(btrim(a->>'pack_name'),''),CASE WHEN pack_count=1 THEN stock_unit ELSE 'Pack of ' || pack_count END);
  IF greatest(length(product_name),length(brand),length(variant),length(requested_category),length(stock_unit),length(pack_name)) > 160
    OR condition NOT IN ('New', 'Used') THEN
    RAISE EXCEPTION 'Use up to 160 characters for each product field and choose a valid condition.';
  END IF;
  IF pack_count NOT BETWEEN 1 AND 1000000 THEN RAISE EXCEPTION 'Enter a pack count from 1 to 1000000.'; END IF;

  size_value := nullif(a->>'package_size_value','')::numeric;
  size_unit := nullif(a->>'package_size_unit','');
  IF (size_value IS NULL) <> (size_unit IS NULL)
    OR (size_value IS NOT NULL AND (size_value <= 0 OR size_value > 1000000000 OR size_unit NOT IN ('g','kg','mL','L'))) THEN
    RAISE EXCEPTION 'Enter a positive package size and choose g, kg, mL, or L, or leave both blank.';
  END IF;
  IF size_unit IN ('kg','L') THEN size_value := size_value * 1000; END IF;
  size_unit := CASE size_unit WHEN 'kg' THEN 'g' WHEN 'L' THEN 'mL' ELSE size_unit END;

  barcode_input := nullif(btrim(a->>'barcode'),'');
  barcode := private.normalize_gtin(barcode_input);
  IF barcode_input IS NOT NULL AND barcode IS NULL THEN RAISE EXCEPTION 'Enter a valid 8-, 12-, 13-, or 14-digit product barcode.'; END IF;

  -- Keep duplicate checks and creation in one transaction, including concurrent requests for this store.
  PERFORM pg_advisory_xact_lock(hashtextextended('store-product:' || store_id::text, 0));
  PERFORM private.own_store(store_id);
  IF barcode IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.store_product sp JOIN public.product_unit u USING (variation_id)
    WHERE sp.sme_id=store_id AND private.normalize_gtin(coalesce(u.store_barcode,u.gtin))=barcode
  ) THEN
    RAISE EXCEPTION 'This barcode already belongs to a product in this store.';
  END IF;
  identity_key := jsonb_build_array(
    lower(regexp_replace(btrim(product_name), '[[:space:]]+', ' ', 'g')),
    lower(regexp_replace(btrim(coalesce(brand,'')), '[[:space:]]+', ' ', 'g')),
    lower(regexp_replace(btrim(variant), '[[:space:]]+', ' ', 'g')),
    trim_scale(size_value), size_unit, stock_unit, condition
  )::text;

  INSERT INTO public.category(sme_id, category_name, product_type)
  VALUES(store_id, requested_category, 'General Retail')
  ON CONFLICT (sme_id, lower(regexp_replace(btrim(category_name), '\s+', ' ', 'g')))
  WHERE sme_id IS NOT NULL DO UPDATE SET category_name=public.category.category_name
  RETURNING category.category_id,category.status INTO category_id,category_status;
  IF category_status <> 'Active' THEN RAISE EXCEPTION 'Choose an active category.'; END IF;

  INSERT INTO public.product(sme_id, category_id, product_name, store_brand_name, owner_identity_key, status)
  VALUES(store_id, category_id, product_name, brand, identity_key, 'Draft')
  ON CONFLICT (sme_id, owner_identity_key) WHERE sme_id IS NOT NULL DO NOTHING
  RETURNING product.product_id INTO chosen_product_id;
  IF chosen_product_id IS NULL THEN
    SELECT p.product_id, v.variation_id, sp.store_product_id
    INTO chosen_product_id, chosen_variation_id, store_product_id
    FROM public.product p
    JOIN public.category c USING (category_id)
    JOIN public.product_variation v USING (product_id)
    JOIN public.store_product sp ON sp.variation_id=v.variation_id AND sp.sme_id=p.sme_id
    WHERE p.sme_id=store_id AND p.owner_identity_key=identity_key
      AND p.status='Active' AND c.status='Active'
      AND v.status='Active' AND sp.status='Active';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'This product already exists. Restore it before adding another pack.';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.product_unit u
      WHERE u.variation_id=chosen_variation_id AND u.stock_units=pack_count
    ) THEN
      RAISE EXCEPTION 'This pack size already exists. Select the existing listing to set or change its price.';
    END IF;
  ELSE
    INSERT INTO public.product_variation(product_id, variation_name, net_quantity, net_unit, condition, stock_unit, variation_key, allow_price_reference)
    VALUES(chosen_product_id, variant, size_value, size_unit, condition, stock_unit, identity_key, true)
    RETURNING product_variation.variation_id INTO chosen_variation_id;

    UPDATE public.product p SET status='Active' WHERE p.product_id=chosen_product_id;
    INSERT INTO public.store_product(sme_id, variation_id) VALUES(store_id, chosen_variation_id)
    RETURNING store_product.store_product_id INTO store_product_id;
  END IF;

  INSERT INTO public.product_unit(variation_id, unit_name, stock_units, store_barcode)
  VALUES(chosen_variation_id, pack_name, pack_count, barcode)
  RETURNING product_unit.unit_id INTO unit_id;
  INSERT INTO public.store_price(store_product_id, unit_id) VALUES(store_product_id, unit_id)
  RETURNING store_price.store_price_id INTO price_id;

  RETURN jsonb_build_object('id', price_id, 'message', 'Product added. Request its first selling price when ready.');
END
$$;

CREATE FUNCTION public.create_store_product(a jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.create_store_product(a)
$$;

REVOKE ALL ON FUNCTION public.create_store_product(jsonb), private.create_store_product(jsonb)
FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_store_product(jsonb), private.create_store_product(jsonb)
TO authenticated;

CREATE OR REPLACE FUNCTION private.public_listings(search text DEFAULT '') RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT coalesce(jsonb_agg(x ORDER BY x.product_name,x.store_name,x.store_price_id),'[]'::jsonb) FROM (
 SELECT s.store_price_id,sm.store_name,sm.business_type,sm.address,p.product_name,p.model_or_style,c.category_name,c.product_type,coalesce(p.store_brand_name,b.brand_name) brand_name,
 v.variation_name,v.size,v.color,v.flavor,v.capacity,v.net_quantity,v.net_unit,v.condition,v.stock_unit,v.other_details,
 u.unit_name,u.stock_units,s.regular_price,coalesce(pe.promotion_price,s.regular_price) selling_price,pe.promotion_name,pe.starts_at promotion_starts_at,pe.ends_at promotion_ends_at,
 CASE WHEN sp.stock_quantity>=u.stock_units THEN 'Available' ELSE 'Out of stock' END availability,s.price_updated_at,
 (SELECT max(recorded_at) FROM public.stock_transaction t WHERE t.store_product_id=sp.store_product_id) availability_updated_at
 FROM public.store_price s JOIN public.store_product sp USING(store_product_id) JOIN public.sme sm USING(sme_id)
 JOIN public.product_variation v USING(variation_id) JOIN public.product p USING(product_id)
 JOIN public.category c USING(category_id) LEFT JOIN public.brand b USING(brand_id) JOIN public.product_unit u ON u.unit_id=s.unit_id
 LEFT JOIN LATERAL (
 SELECT e.promotion_price,pr.promotion_name,pr.starts_at,pr.ends_at FROM public.promotion_entry e JOIN public.promotion pr USING(promotion_id)
 WHERE e.store_price_id=s.store_price_id AND e.status='Approved' AND pr.status='Open' AND now()>=pr.starts_at AND now()<pr.ends_at
 AND e.promotion_price<s.regular_price ORDER BY e.promotion_entry_id DESC LIMIT 1) pe ON true
 WHERE s.regular_price IS NOT NULL AND private.active_option(s.store_price_id)
 AND concat_ws(' ',p.product_name,p.model_or_style,coalesce(p.store_brand_name,b.brand_name),v.variation_name,v.size,v.color,v.flavor,v.capacity,u.unit_name,sm.store_name,c.category_name) ILIKE '%'||left(search,120)||'%'
 ) x
$$;
