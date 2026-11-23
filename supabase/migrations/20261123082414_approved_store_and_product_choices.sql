-- Shared category defaults can be used independently by each store.
DROP INDEX public.category_name_key;
DROP INDEX public.legacy_category_name;
CREATE UNIQUE INDEX legacy_category_name
 ON public.category(lower(btrim(category_name))) WHERE sme_id IS NULL;

CREATE FUNCTION private.choice_key(value text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
 SELECT lower(regexp_replace(btrim(value), '[[:space:]]+', ' ', 'g'))
$$;

CREATE TABLE public.catalog_choice (
 choice_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 kind text NOT NULL CHECK (kind IN ('business_type','product_category','stock_unit')),
 label text NOT NULL CHECK (length(label) BETWEEN 1 AND 80),
 choice_key text GENERATED ALWAYS AS (private.choice_key(label)) STORED NOT NULL,
 UNIQUE (kind,choice_key)
);

CREATE TABLE public.catalog_choice_request (
 choice_request_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 kind text NOT NULL CHECK (kind IN ('business_type','product_category','stock_unit')),
 label text NOT NULL CHECK (length(label) BETWEEN 1 AND 80),
 choice_key text GENERATED ALWAYS AS (private.choice_key(label)) STORED NOT NULL,
 requested_by uuid NOT NULL REFERENCES public.user_account(user_id),
 requested_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
 reviewed_by uuid REFERENCES public.user_account(user_id),
 reviewed_at timestamptz,
 decision_reason text
);

CREATE UNIQUE INDEX one_pending_catalog_choice_per_owner
 ON public.catalog_choice_request (requested_by,kind,choice_key) WHERE status='Pending';

ALTER TABLE public.catalog_choice ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_choice_request ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.catalog_choice,public.catalog_choice_request FROM public,anon,authenticated;
GRANT SELECT ON public.catalog_choice,public.catalog_choice_request TO authenticated;

CREATE POLICY catalog_choice_read ON public.catalog_choice FOR SELECT TO authenticated
 USING ((SELECT private.current_role()) IN ('Owner','Administrator'));
CREATE POLICY catalog_choice_request_read ON public.catalog_choice_request FOR SELECT TO authenticated
 USING ((SELECT private.current_role())='Administrator'
  OR ((SELECT private.current_role())='Owner' AND requested_by=(SELECT auth.uid())));

INSERT INTO public.catalog_choice(kind,label) VALUES
 ('business_type','General retail'),('business_type','Sari-sari store'),
 ('business_type','Grocery'),('business_type','Convenience store'),
 ('business_type','Market stall'),('business_type','Bakery'),
 ('business_type','Food and beverage shop'),('business_type','Hardware store'),
 ('business_type','Pharmacy'),('business_type','Clothing and accessories'),
 ('business_type','Electronics shop'),('business_type','School and office supplies'),
 ('business_type','Personal care shop'),('business_type','Pet supplies'),
 ('product_category','Uncategorized'),('product_category','Food'),
 ('product_category','Beverages'),('product_category','Pantry'),
 ('product_category','Fresh produce'),('product_category','Meat and seafood'),
 ('product_category','Dairy and eggs'),('product_category','Frozen food'),
 ('product_category','Snacks'),('product_category','Household supplies'),
 ('product_category','Personal care'),('product_category','Health supplies'),
 ('product_category','Clothing'),('product_category','Electronics'),
 ('product_category','School and office supplies'),('product_category','Hardware'),
 ('product_category','Pet supplies'),
 ('stock_unit','piece'),('stock_unit','pair'),('stock_unit','bottle'),
 ('stock_unit','can'),('stock_unit','bag'),('stock_unit','sachet'),
 ('stock_unit','roll'),('stock_unit','pack'),('stock_unit','box'),
 ('stock_unit','jar'),('stock_unit','carton'),('stock_unit','pouch'),
 ('stock_unit','bar'),('stock_unit','tube'),('stock_unit','tray'),
 ('stock_unit','bundle'),('stock_unit','dozen'),('stock_unit','sheet'),
 ('stock_unit','set'),('stock_unit','kilogram'),('stock_unit','litre');

CREATE FUNCTION private.approved_choice(choice_kind text, selected text) RETURNS text
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE approved text;
BEGIN
 SELECT label INTO approved FROM public.catalog_choice
 WHERE kind=choice_kind AND choice_key=private.choice_key(selected);
 IF approved IS NULL THEN
  RAISE EXCEPTION 'Choose an approved option or request a new one for Administrator review.';
 END IF;
 RETURN approved;
END $$;

CREATE FUNCTION private.enforce_catalog_choice() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 CASE TG_TABLE_NAME
 WHEN 'sme' THEN
  NEW.business_type:=private.approved_choice('business_type',NEW.business_type);
 WHEN 'category' THEN
  IF NEW.sme_id IS NOT NULL THEN
   NEW.category_name:=private.approved_choice('product_category',NEW.category_name);
  END IF;
 WHEN 'product_variation' THEN
  IF EXISTS (SELECT 1 FROM public.product p WHERE p.product_id=NEW.product_id AND p.sme_id IS NOT NULL) THEN
   NEW.stock_unit:=private.approved_choice('stock_unit',NEW.stock_unit);
  END IF;
 END CASE;
 RETURN NEW;
END $$;

CREATE TRIGGER approved_business_type
 BEFORE INSERT OR UPDATE OF business_type ON public.sme
 FOR EACH ROW EXECUTE FUNCTION private.enforce_catalog_choice();
CREATE TRIGGER approved_product_category
 BEFORE INSERT OR UPDATE OF category_name ON public.category
 FOR EACH ROW EXECUTE FUNCTION private.enforce_catalog_choice();
CREATE TRIGGER approved_product_stock_unit
 BEFORE INSERT OR UPDATE OF stock_unit ON public.product_variation
 FOR EACH ROW EXECUTE FUNCTION private.enforce_catalog_choice();

CREATE FUNCTION private.manage_catalog_choice(a jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 actor uuid;
 proposed text;
 reason text;
 decision text;
 request_row public.catalog_choice_request;
BEGIN
 IF a->>'action'='request' THEN
  actor:=private.require_role(ARRAY['Owner']);
  proposed:=regexp_replace(btrim(coalesce(a->>'label','')), '[[:space:]]+', ' ', 'g');
  IF a->>'kind'='stock_unit' THEN proposed:=private.clean(proposed); END IF;
  IF length(proposed) NOT BETWEEN 1 AND 80 THEN
   RAISE EXCEPTION 'Enter an option name of up to 80 characters.';
  END IF;
  IF coalesce(a->>'kind','') NOT IN ('business_type','product_category','stock_unit') THEN
   RAISE EXCEPTION 'Choose a valid type of option.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.catalog_choice WHERE kind=a->>'kind' AND choice_key=private.choice_key(proposed)) THEN
   RAISE EXCEPTION 'This option is already available.';
  END IF;
  INSERT INTO public.catalog_choice_request (kind,label,requested_by)
  VALUES(a->>'kind',proposed,actor)
  ON CONFLICT (requested_by,kind,choice_key) WHERE status='Pending' DO NOTHING;
  IF NOT FOUND THEN RAISE EXCEPTION 'You already requested this option.'; END IF;
  RETURN jsonb_build_object('message','Option request sent for review.');
 ELSIF a->>'action'='update_business_type' THEN
  actor:=private.require_role(ARRAY['Owner']);
  UPDATE public.sme SET business_type=a->>'business_type'
  WHERE sme_id=(a->>'sme_id')::bigint AND owner_id=actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'Choose a store you own.'; END IF;
  RETURN jsonb_build_object('message','Business type updated.');
 ELSIF a->>'action'='review' THEN
  actor:=private.require_role(ARRAY['Administrator']);
  decision:=coalesce(a->>'decision','');
  IF decision NOT IN ('Approved','Rejected') THEN
   RAISE EXCEPTION 'Choose Approve or Reject.';
  END IF;
  reason:=nullif(btrim(a->>'decision_reason'),'');
  IF decision='Rejected' THEN
   reason:=private.required(reason,'reason for rejection');
  END IF;
  SELECT * INTO request_row FROM public.catalog_choice_request
  WHERE choice_request_id=(a->>'choice_request_id')::bigint AND status='Pending'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This request is no longer waiting for review.'; END IF;
  IF decision='Approved' THEN
   INSERT INTO public.catalog_choice(kind,label)
   VALUES(request_row.kind,CASE WHEN request_row.kind='stock_unit' THEN lower(request_row.label) ELSE request_row.label END)
   ON CONFLICT (kind,choice_key) DO NOTHING;
  END IF;
  UPDATE public.catalog_choice_request
  SET status=decision,reviewed_by=actor,reviewed_at=now(),decision_reason=reason
  WHERE choice_request_id=request_row.choice_request_id;
  RETURN jsonb_build_object('message', CASE WHEN decision='Approved' THEN 'Option approved and available to Owners.' ELSE 'Option request rejected.' END);
 END IF;
 RAISE EXCEPTION 'Choose a valid choice action.';
END $$;

CREATE FUNCTION public.manage_catalog_choice(a jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
 SELECT private.manage_catalog_choice(a)
$$;

REVOKE ALL ON FUNCTION private.choice_key(text), private.approved_choice(text,text), private.enforce_catalog_choice() FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION private.manage_catalog_choice(jsonb), public.manage_catalog_choice(jsonb) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.manage_catalog_choice(jsonb),public.manage_catalog_choice(jsonb) TO authenticated;
