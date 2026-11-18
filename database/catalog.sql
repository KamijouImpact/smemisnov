CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE FUNCTION private.clean(value text) RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $$ SELECT trim(regexp_replace(lower(extensions.unaccent(coalesce(value,''))),'\s+',' ','g')) $$;
CREATE FUNCTION private.catalog_product_has_unit(id bigint) RETURNS boolean
LANGUAGE sql STABLE SET search_path = '' AS $$
 SELECT EXISTS (
  SELECT 1
  FROM public.product_variation v
  JOIN public.product_unit u USING (variation_id)
  WHERE v.product_id=id AND v.status='Active' AND u.status='Active'
 )
$$;
REVOKE ALL ON FUNCTION private.catalog_product_has_unit(bigint) FROM public,anon,authenticated;

CREATE OR REPLACE FUNCTION private.catalog_action(action text,a jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid; id bigint; v bigint; u bigint; sp bigint; product_key bigint; variation_name text; new_status text; req public.product_request; key text; q numeric; n integer;
BEGIN
 uid:=private.require_role(ARRAY['Administrator']);
 -- Serialize catalog writes so two archives cannot remove the last active unit concurrently.
 PERFORM pg_advisory_xact_lock(731902);
 IF action='category' THEN
 INSERT INTO public.category(category_name,product_type) VALUES(private.required(a->>'category_name','category name'),a->>'product_type') RETURNING category_id INTO id;
 ELSIF action='brand' THEN
 INSERT INTO public.brand(brand_name,search_key) VALUES(private.required(a->>'brand_name','brand name'),private.clean(a->>'brand_name')) RETURNING brand_id INTO id;
 ELSIF action='product' THEN
 INSERT INTO public.product(category_id,brand_id,product_name,model_or_style) VALUES((a->>'category_id')::bigint,nullif(a->>'brand_id','')::bigint,private.required(a->>'product_name','product name'),nullif(trim(a->>'model_or_style'),'')) RETURNING product_id INTO id;
 ELSIF action='variation' THEN
 variation_name:=coalesce(nullif(trim(a->>'variation_name'),''),'Standard');
 q:=nullif(a->>'net_quantity','')::numeric;
 IF q IS NOT NULL AND (q::text IN ('NaN','Infinity','-Infinity') OR q<=0 OR q>1000000000) THEN RAISE EXCEPTION 'Enter a valid net quantity.'; END IF;
 IF a->>'net_unit' IN ('kg','L') THEN q:=q*1000; END IF;
 key:=private.clean(concat_ws('|',variation_name,a->>'size',a->>'color',a->>'flavor',a->>'capacity',trim_scale(q)::text,CASE a->>'net_unit' WHEN 'kg' THEN 'g' WHEN 'L' THEN 'mL' ELSE a->>'net_unit' END,coalesce(a->>'condition','New'),a->>'stock_unit',a->>'other_details'));
 INSERT INTO public.product_variation(product_id,variation_name,size,color,flavor,capacity,net_quantity,net_unit,condition,stock_unit,other_details,variation_key,allow_price_reference)
 VALUES((a->>'product_id')::bigint,private.required(variation_name,'variation name'),nullif(trim(a->>'size'),''),nullif(trim(a->>'color'),''),nullif(trim(a->>'flavor'),''),nullif(trim(a->>'capacity'),''),q,CASE a->>'net_unit' WHEN 'kg' THEN 'g' WHEN 'L' THEN 'mL' ELSE nullif(a->>'net_unit','') END,coalesce(a->>'condition','New'),private.required(a->>'stock_unit','stock unit'),nullif(trim(a->>'other_details'),''),key,coalesce((a->>'allow_price_reference')::boolean,false)) RETURNING variation_id INTO id;
 ELSIF action='unit' THEN
 n:=(a->>'stock_units')::integer; IF n<1 OR n>1000000 THEN RAISE EXCEPTION 'Enter 1 to 1000000 stock units per package.'; END IF;
 INSERT INTO public.product_unit(variation_id,unit_name,stock_units,gtin) VALUES((a->>'variation_id')::bigint,private.clean(private.required(a->>'unit_name','selling unit name')),n,nullif(trim(a->>'gtin'),'')) RETURNING unit_id INTO id;
 SELECT product_id INTO product_key FROM public.product_variation WHERE variation_id=(a->>'variation_id')::bigint;
 UPDATE public.product SET status='Active'
 WHERE product_id=product_key AND status='Draft' AND private.catalog_product_has_unit(product_key);
 ELSIF action='catalog_status' THEN
 IF coalesce(a->>'table','') NOT IN ('category','brand','product','product_variation','product_unit') THEN RAISE EXCEPTION 'Choose a catalog record.'; END IF;
 new_status:=a->>'status'; IF coalesce(new_status,'') NOT IN ('Active','Archived') THEN RAISE EXCEPTION 'Choose Active or Archived.'; END IF;
 key:=CASE a->>'table' WHEN 'category' THEN 'category_id' WHEN 'brand' THEN 'brand_id' WHEN 'product' THEN 'product_id' WHEN 'product_variation' THEN 'variation_id' ELSE 'unit_id' END;
 EXECUTE format('UPDATE public.%I SET status=$1 WHERE %I=$2',a->>'table',key) USING new_status,(a->>'id')::bigint;
 IF a->>'table'='product' THEN
  product_key:=(a->>'id')::bigint;
 ELSIF a->>'table'='product_variation' THEN
  SELECT product_id INTO product_key FROM public.product_variation WHERE variation_id=(a->>'id')::bigint;
 ELSIF a->>'table'='product_unit' THEN
  SELECT v.product_id INTO product_key FROM public.product_unit u
  JOIN public.product_variation v USING (variation_id) WHERE u.unit_id=(a->>'id')::bigint;
 END IF;
 IF EXISTS(SELECT 1 FROM public.product WHERE product_id=product_key AND status='Active')
    AND NOT private.catalog_product_has_unit(product_key) THEN
  RAISE EXCEPTION 'An active product needs an active option and pack size. Archive the product first or add a replacement.';
 END IF;
 ELSIF action='review_product' THEN
 SELECT * INTO STRICT req FROM public.product_request WHERE product_request_id=(a->>'product_request_id')::bigint FOR UPDATE;
 IF req.status<>'Pending Product Review' THEN RAISE EXCEPTION 'This request is already decided.'; END IF;
 new_status:=a->>'decision'; IF new_status NOT IN ('Approved','Rejected') THEN RAISE EXCEPTION 'Choose Approved or Rejected.'; END IF;
 IF new_status='Approved' THEN
 SELECT variation_id,unit_id INTO STRICT v,u FROM public.product_unit WHERE unit_id=(a->>'unit_id')::bigint AND status='Active';
 IF NOT EXISTS(SELECT 1 FROM public.product_variation pv JOIN public.product p USING(product_id) JOIN public.category c USING(category_id) LEFT JOIN public.brand b USING(brand_id) WHERE pv.variation_id=v AND pv.status='Active' AND p.status='Active' AND c.status='Active' AND (b.brand_id IS NULL OR b.status='Active')) THEN RAISE EXCEPTION 'Choose approved active product details.'; END IF;
 INSERT INTO public.store_product(sme_id,variation_id) VALUES(req.sme_id,v) ON CONFLICT(sme_id,variation_id) DO UPDATE SET status='Active' RETURNING store_product_id INTO sp;
 INSERT INTO public.store_price(store_product_id,unit_id) VALUES(sp,u) ON CONFLICT(store_product_id,unit_id) DO UPDATE SET status='Active';
 END IF;
 UPDATE public.product_request SET status=new_status,reviewed_by=uid,reviewed_at=now(),decision_reason=private.required(a->>'decision_reason','decision reason'),approved_variation_id=v,approved_unit_id=u WHERE product_request_id=req.product_request_id;
 ELSE RAISE EXCEPTION 'Unknown catalog action.';
 END IF;
 RETURN jsonb_build_object('id',id,'message','Catalog record saved.');
END $$;
