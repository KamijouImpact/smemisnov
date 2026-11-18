CREATE OR REPLACE FUNCTION private.submit_price(a jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid; opt public.store_price; sp public.store_product; rule public.price_rule; id bigint; proposal numeric; prior bigint; count_sources integer; median numeric; cutoff numeric; reason text; reliable boolean;
BEGIN
 uid:=private.require_role(ARRAY['Owner']); PERFORM pg_advisory_xact_lock(731901);
 opt:=private.own_option((a->>'store_price_id')::bigint);
 SELECT * INTO sp FROM public.store_product WHERE store_product_id=opt.store_product_id;
 proposal:=private.money(a->>'proposed_price');
 IF proposal IS NOT DISTINCT FROM opt.regular_price THEN RAISE EXCEPTION 'This is already the approved price.'; END IF;
 prior:=nullif(a->>'previous_request_id','')::bigint;
 IF prior IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.price_request WHERE price_request_id=prior AND store_price_id=opt.store_price_id AND status IN ('Rejected','Withdrawn')) THEN RAISE EXCEPTION 'Choose a rejected or withdrawn request for this same listing.'; END IF;
 SELECT * INTO rule FROM public.price_rule WHERE status='Active' AND effective_from<=now();
 SELECT allow_price_reference INTO reliable FROM public.product_variation WHERE variation_id=sp.variation_id;
 INSERT INTO public.price_request(store_price_id,submitted_by,previous_price,proposed_price,owner_reason,submitted_at,checked_at,rule_id,previous_request_id)
 VALUES(opt.store_price_id,uid,opt.regular_price,proposal,nullif(trim(a->>'owner_reason'),''),now(),now(),rule.rule_id,prior) RETURNING price_request_id INTO id;
 IF rule.rule_id IS NOT NULL AND reliable THEN
 INSERT INTO public.price_reference(price_request_id,reference_sme_id,price_history_id)
 SELECT id,osp.sme_id,h.price_history_id FROM public.store_price op
 JOIN public.store_product osp ON osp.store_product_id=op.store_product_id
 JOIN LATERAL (SELECT ph.* FROM public.price_history ph WHERE ph.store_price_id=op.store_price_id ORDER BY ph.price_history_id DESC LIMIT 1) h ON true
 WHERE osp.variation_id=sp.variation_id AND op.unit_id=opt.unit_id AND osp.sme_id<>sp.sme_id
 AND private.active_option(op.store_price_id) AND op.regular_price=h.new_price AND op.price_updated_at=h.effective_at
 AND h.effective_at>=now()-make_interval(days=>rule.maximum_age_days);
 END IF;
 SELECT count(*) INTO count_sources FROM public.price_reference WHERE price_request_id=id;
 SELECT avg(x.new_price) INTO median FROM (
 SELECT h.new_price,row_number() OVER(ORDER BY h.new_price) rank FROM public.price_reference r JOIN public.price_history h USING(price_history_id) WHERE r.price_request_id=id
 ) x WHERE x.rank IN ((count_sources+1)/2,(count_sources+2)/2);
 cutoff:=floor(median*(1+rule.allowance_percent/100)*100)/100;
 reason:=CASE WHEN NOT reliable THEN 'Unreliable Product Match' WHEN rule.rule_id IS NULL THEN 'No Active Rule' WHEN count_sources<rule.minimum_stores THEN 'Too Few References' WHEN proposal>cutoff THEN 'Above Reference' ELSE NULL END;
 UPDATE public.price_request SET reference_count=count_sources,reference_median=median,allowed_price=cutoff,review_reason=reason WHERE price_request_id=id;
 IF reason IS NULL THEN PERFORM private.activate_price(id,'System',NULL,'Within the current price rule.'); END IF;
 RETURN jsonb_build_object('id',id,'message',CASE WHEN reason IS NULL THEN 'Price approved.' ELSE 'Pending Price Review: '||reason||'. Your current approved price stays in use.' END);
END $$;
CREATE OR REPLACE FUNCTION private.review_price(a jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid; r public.price_request; reason text; decision text; BEGIN
 uid:=private.require_role(ARRAY['Administrator']); PERFORM pg_advisory_xact_lock(731901);
 SELECT * INTO STRICT r FROM public.price_request WHERE price_request_id=(a->>'price_request_id')::bigint FOR UPDATE;
 IF r.status<>'Pending Price Review' THEN RAISE EXCEPTION 'This request is already decided.'; END IF;
 reason:=private.required(a->>'decision_reason','decision reason'); decision:=a->>'decision';
 IF decision='Approved' THEN
 IF r.review_reason='Above Reference' AND trim(coalesce(r.owner_reason,''))='' THEN RAISE EXCEPTION 'Ask the Owner to explain the higher price before approval.'; END IF;
 PERFORM private.activate_price(r.price_request_id,'Administrator',uid,reason);
 ELSIF decision='Rejected' THEN UPDATE public.price_request SET status='Rejected',decision_source='Administrator',reviewed_by=uid,decided_at=now(),decision_reason=reason WHERE price_request_id=r.price_request_id;
 ELSE RAISE EXCEPTION 'Choose Approved or Rejected.'; END IF;
 RETURN jsonb_build_object('message','Price request '||lower(decision)||'.');
END $$;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE OR REPLACE FUNCTION private.clean(value text) RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $$ SELECT trim(regexp_replace(lower(extensions.unaccent(coalesce(value,''))),'\s+',' ','g')) $$;
CREATE OR REPLACE FUNCTION private.catalog_action(action text,a jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid; id bigint; v bigint; u bigint; sp bigint; new_status text; req public.product_request; key text; q numeric; n integer;
BEGIN
 uid:=private.require_role(ARRAY['Administrator']);
 IF action='category' THEN
 INSERT INTO public.category(category_name,product_type) VALUES(private.required(a->>'category_name','category name'),a->>'product_type') RETURNING category_id INTO id;
 ELSIF action='brand' THEN
 INSERT INTO public.brand(brand_name,search_key) VALUES(private.required(a->>'brand_name','brand name'),private.clean(a->>'brand_name')) RETURNING brand_id INTO id;
 ELSIF action='product' THEN
 INSERT INTO public.product(category_id,brand_id,product_name,model_or_style) VALUES((a->>'category_id')::bigint,nullif(a->>'brand_id','')::bigint,private.required(a->>'product_name','product name'),nullif(trim(a->>'model_or_style'),'')) RETURNING product_id INTO id;
 ELSIF action='variation' THEN
 q:=nullif(a->>'net_quantity','')::numeric;
 IF q IS NOT NULL AND (q::text IN ('NaN','Infinity','-Infinity') OR q<=0 OR q>1000000000) THEN RAISE EXCEPTION 'Enter a valid net quantity.'; END IF;
 IF a->>'net_unit' IN ('kg','L') THEN q:=q*1000; END IF;
 key:=private.clean(concat_ws('|',a->>'variation_name',a->>'size',a->>'color',a->>'flavor',a->>'capacity',trim_scale(q)::text,CASE a->>'net_unit' WHEN 'kg' THEN 'g' WHEN 'L' THEN 'mL' ELSE a->>'net_unit' END,coalesce(a->>'condition','New'),a->>'stock_unit',a->>'other_details'));
 INSERT INTO public.product_variation(product_id,variation_name,size,color,flavor,capacity,net_quantity,net_unit,condition,stock_unit,other_details,variation_key,allow_price_reference)
 VALUES((a->>'product_id')::bigint,private.required(a->>'variation_name','variation name'),nullif(trim(a->>'size'),''),nullif(trim(a->>'color'),''),nullif(trim(a->>'flavor'),''),nullif(trim(a->>'capacity'),''),q,CASE a->>'net_unit' WHEN 'kg' THEN 'g' WHEN 'L' THEN 'mL' ELSE nullif(a->>'net_unit','') END,coalesce(a->>'condition','New'),private.required(a->>'stock_unit','stock unit'),nullif(trim(a->>'other_details'),''),key,coalesce((a->>'allow_price_reference')::boolean,false)) RETURNING variation_id INTO id;
 ELSIF action='unit' THEN
 n:=(a->>'stock_units')::integer; IF n<1 OR n>1000000 THEN RAISE EXCEPTION 'Enter 1 to 1000000 stock units per package.'; END IF;
 INSERT INTO public.product_unit(variation_id,unit_name,stock_units,gtin) VALUES((a->>'variation_id')::bigint,private.clean(private.required(a->>'unit_name','selling unit name')),n,nullif(trim(a->>'gtin'),'')) RETURNING unit_id INTO id;
 ELSIF action='catalog_status' THEN
 IF a->>'table' NOT IN ('category','brand','product','product_variation','product_unit') THEN RAISE EXCEPTION 'Choose a catalog record.'; END IF;
 new_status:=a->>'status'; IF new_status NOT IN ('Active','Archived') THEN RAISE EXCEPTION 'Choose Active or Archived.'; END IF;
 key:=CASE a->>'table' WHEN 'category' THEN 'category_id' WHEN 'brand' THEN 'brand_id' WHEN 'product' THEN 'product_id' WHEN 'product_variation' THEN 'variation_id' ELSE 'unit_id' END;
 EXECUTE format('UPDATE public.%I SET status=$1 WHERE %I=$2',a->>'table',key) USING new_status,(a->>'id')::bigint;
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

REVOKE ALL ON FUNCTION private.submit_price(jsonb),private.review_price(jsonb),private.catalog_action(text,jsonb) FROM public,anon,authenticated;
DROP INDEX public.sme_owner_id_fk;
DROP INDEX public.product_variation_product_id_fk;
DROP INDEX public.store_product_sme_id_fk;
DROP INDEX public.store_price_store_product_id_fk;
