CREATE OR REPLACE FUNCTION private.mis_command(action text,a jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid; role_name text; id bigint; sp public.store_product; opt public.store_price; u public.product_unit; r public.price_request; cr public.customer_report; status_value text; n integer; title text; amount numeric;
BEGIN
 uid:=private.require_role(ARRAY['Administrator','Owner','Customer']); role_name:=private.current_role();
 IF jsonb_typeof(a)<>'object' OR octet_length(a::text)>30000 THEN RAISE EXCEPTION 'Invalid request.'; END IF;
 IF action IN ('category','brand','product','variation','unit','catalog_status','review_product') THEN RETURN private.catalog_action(action,a);
 ELSIF action IN ('promotion','cancel_promotion','promotion_entry','review_promotion','withdraw_promotion') THEN RETURN private.promotion_action(action,a);
 ELSIF action='submit_price' THEN RETURN private.submit_price(a);
 ELSIF action='review_price' THEN RETURN private.review_price(a);
 ELSIF action='stock' THEN RETURN private.record_stock(a);
 ELSIF action='complete_registration' THEN
 -- Selecting Owner is an allowed public registration choice; Administrator is never self-assigned.
 IF a->>'role' NOT IN ('Owner','Customer') OR role_name='Administrator' THEN RAISE EXCEPTION 'Choose Owner or Customer.'; END IF;
 IF role_name='Owner' AND a->>'role'='Customer' THEN RAISE EXCEPTION 'An Owner account cannot be changed to Customer.'; END IF;
 UPDATE public.user_account SET role=a->>'role',full_name=left(private.required(a->>'full_name','full name'),120) WHERE user_id=uid;
 ELSIF action='profile' THEN UPDATE public.user_account SET full_name=left(private.required(a->>'full_name','full name'),120) WHERE user_id=uid;
 ELSIF action='store' THEN
 PERFORM private.require_role(ARRAY['Owner']);
 INSERT INTO public.sme(owner_id,store_name,business_type,address,registered_at) VALUES(uid,left(private.required(a->>'store_name','store name'),160),left(private.required(a->>'business_type','business type'),120),private.required(a->>'address','address'),now()) RETURNING sme_id INTO id;
 ELSIF action='store_status' THEN
 PERFORM private.require_role(ARRAY['Administrator']); status_value:=a->>'status'; IF status_value NOT IN ('Active','Inactive') THEN RAISE EXCEPTION 'Choose Active or Inactive.'; END IF;
 UPDATE public.sme SET status=status_value WHERE sme_id=(a->>'sme_id')::bigint;
 ELSIF action='account_status' THEN
 PERFORM private.require_role(ARRAY['Administrator']); status_value:=a->>'status'; IF status_value NOT IN ('Active','Inactive') THEN RAISE EXCEPTION 'Choose Active or Inactive.'; END IF;
 IF (a->>'user_id')::uuid=uid OR EXISTS(SELECT 1 FROM public.user_account WHERE user_id=(a->>'user_id')::uuid AND role='Administrator') THEN RAISE EXCEPTION 'Administrator accounts are managed through the database owner.'; END IF;
 UPDATE public.user_account SET status=status_value WHERE user_id=(a->>'user_id')::uuid;
 ELSIF action='list_unit' THEN
 PERFORM private.own_store((a->>'sme_id')::bigint);
 SELECT * INTO STRICT u FROM public.product_unit WHERE unit_id=(a->>'unit_id')::bigint AND status='Active';
 IF NOT EXISTS(SELECT 1 FROM public.product_variation v JOIN public.product p USING(product_id) JOIN public.category c USING(category_id) LEFT JOIN public.brand b USING(brand_id) WHERE v.variation_id=u.variation_id AND v.status='Active' AND p.status='Active' AND c.status='Active' AND (b.brand_id IS NULL OR b.status='Active')) THEN RAISE EXCEPTION 'Choose an active shared product.'; END IF;
 INSERT INTO public.store_product(sme_id,variation_id) VALUES((a->>'sme_id')::bigint,u.variation_id) ON CONFLICT(sme_id,variation_id) DO UPDATE SET status='Active' RETURNING store_product_id INTO id;
 INSERT INTO public.store_price(store_product_id,unit_id) VALUES(id,u.unit_id) ON CONFLICT(store_product_id,unit_id) DO UPDATE SET status='Active';
 ELSIF action='listing_status' THEN
 PERFORM private.require_role(ARRAY['Owner']); status_value:=a->>'status'; IF status_value NOT IN ('Active','Archived') THEN RAISE EXCEPTION 'Choose Active or Archived.'; END IF;
 SELECT * INTO STRICT opt FROM public.store_price WHERE store_price_id=(a->>'store_price_id')::bigint FOR UPDATE;
 SELECT * INTO STRICT sp FROM public.store_product WHERE store_product_id=opt.store_product_id;
 PERFORM private.own_store(sp.sme_id); UPDATE public.store_price SET status=status_value WHERE store_price_id=opt.store_price_id;
 ELSIF action='product_request' THEN
 PERFORM private.own_store((a->>'sme_id')::bigint);
 INSERT INTO public.product_request(sme_id,submitted_by,requested_details,submitted_at) VALUES((a->>'sme_id')::bigint,uid,private.required(a->>'requested_details','product details'),now()) RETURNING product_request_id INTO id;
 ELSIF action='price_explanation' OR action='withdraw_price' THEN
 PERFORM private.require_role(ARRAY['Owner']);
 SELECT * INTO STRICT r FROM public.price_request WHERE price_request_id=(a->>'price_request_id')::bigint FOR UPDATE;
 IF NOT private.can_price(r.store_price_id) THEN RAISE EXCEPTION 'Choose your own price request.'; END IF;
 IF r.status<>'Pending Price Review' THEN RAISE EXCEPTION 'This request is no longer pending.'; END IF;
 IF action='price_explanation' THEN UPDATE public.price_request SET owner_reason=private.required(a->>'owner_reason','explanation') WHERE price_request_id=r.price_request_id;
 ELSE UPDATE public.price_request SET status='Withdrawn',decided_at=now(),decision_reason=private.required(a->>'decision_reason','withdrawal reason') WHERE price_request_id=r.price_request_id; END IF;
 ELSIF action='rule' THEN
 PERFORM private.require_role(ARRAY['Administrator']); PERFORM pg_advisory_xact_lock(731901);
 amount:=private.money(a->>'allowance_percent',true); n:=(a->>'minimum_stores')::integer;
 IF n NOT BETWEEN 1 AND 10000 OR (a->>'maximum_age_days')::integer NOT BETWEEN 1 AND 3650 THEN RAISE EXCEPTION 'Enter a valid reference count and maximum age.'; END IF;
 UPDATE public.price_rule SET status='Inactive' WHERE status='Active';
 INSERT INTO public.price_rule(allowance_percent,minimum_stores,maximum_age_days,effective_from,created_by) VALUES(amount,n,(a->>'maximum_age_days')::integer,now(),uid) RETURNING rule_id INTO id;
 ELSIF action='low_stock' THEN
 sp:=private.own_product((a->>'store_product_id')::bigint); n:=(a->>'low_stock_level')::integer;
 IF n NOT BETWEEN 0 AND 100000000 THEN RAISE EXCEPTION 'Enter a valid low-stock level.'; END IF;
 UPDATE public.store_product SET low_stock_level=n WHERE store_product_id=sp.store_product_id;
 ELSIF action='customer_report' THEN
 PERFORM private.require_role(ARRAY['Customer']);
 IF nullif(a->>'transaction_at','')::timestamptz>now() THEN RAISE EXCEPTION 'The transaction time cannot be in the future.'; END IF;
 SELECT * INTO opt FROM public.store_price
 WHERE store_price_id=(a->>'store_price_id')::bigint AND regular_price IS NOT NULL AND private.active_option(store_price_id);
 IF NOT FOUND THEN RAISE EXCEPTION 'Choose an active listed product.'; END IF;
 INSERT INTO public.customer_report(customer_id,store_price_id,listed_price,charged_price,transaction_at,description,evidence_reference,submitted_at)
 VALUES(uid,opt.store_price_id,private.money(a->>'listed_price'),CASE WHEN nullif(a->>'charged_price','') IS NOT NULL THEN private.money(a->>'charged_price') END,nullif(a->>'transaction_at','')::timestamptz,private.required(a->>'description','report details'),nullif(trim(a->>'evidence_reference'),''),now()) RETURNING customer_report_id INTO id;
 ELSIF action='request_report_response' THEN
 PERFORM private.require_role(ARRAY['Administrator']);
 UPDATE public.customer_report
 SET owner_response_requested_by=uid,owner_response_requested_at=now(),status='Under Review'
 WHERE customer_report_id=(a->>'customer_report_id')::bigint AND status<>'Closed'
 AND owner_response IS NULL AND owner_response_requested_at IS NULL
 RETURNING customer_report_id INTO id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Choose an open report that is awaiting a response request.'; END IF;
 ELSIF action='report_response' THEN
 PERFORM private.require_role(ARRAY['Owner']);
 SELECT * INTO cr FROM public.customer_report
 WHERE customer_report_id=(a->>'customer_report_id')::bigint AND private.can_price(store_price_id) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Choose a report for your own store.'; END IF;
 IF cr.owner_response IS NOT NULL THEN RAISE EXCEPTION 'Your response is already recorded. Contact the Administrator if a correction is needed.'; END IF;
 IF cr.status='Closed' THEN RAISE EXCEPTION 'This report is already closed.'; END IF;
 IF cr.owner_response_requested_at IS NULL THEN RAISE EXCEPTION 'The Administrator has not requested a response.'; END IF;
 UPDATE public.customer_report SET status='Under Review',owner_response=private.required(a->>'owner_response','response'),responded_by=uid,responded_at=now() WHERE customer_report_id=cr.customer_report_id;
 ELSIF action='review_report' THEN
 PERFORM private.require_role(ARRAY['Administrator']);
 SELECT * INTO cr FROM public.customer_report WHERE customer_report_id=(a->>'customer_report_id')::bigint FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Choose an open report.'; END IF;
 IF cr.status='Closed' THEN RAISE EXCEPTION 'This report is already closed.'; END IF;
 status_value:=a->>'status'; IF status_value IS NULL OR status_value NOT IN ('Under Review','Closed') THEN RAISE EXCEPTION 'Choose Under Review or Closed.'; END IF;
 IF status_value='Closed' AND cr.owner_response IS NULL AND cr.owner_response_requested_at IS NULL THEN
  RAISE EXCEPTION 'Request an Owner response before closing this report.';
 END IF;
 title:=nullif(a->>'outcome','');
 IF status_value='Closed' AND (title IS NULL OR title NOT IN ('Confirmed Discrepancy','Package Mismatch','Insufficient Evidence','No Discrepancy Established')) THEN RAISE EXCEPTION 'Choose a closure outcome.'; END IF;
 UPDATE public.customer_report
 SET status=status_value,reviewed_by=uid,outcome=CASE WHEN status_value='Closed' THEN title END,
 outcome_details=private.required(a->>'outcome_details','review findings'),
 no_response_reason=CASE WHEN status_value='Closed' AND cr.owner_response IS NULL
   THEN private.required(a->>'no_response_reason','reason for closing without an Owner response') END,
 closed_at=CASE WHEN status_value='Closed' THEN now() END
 WHERE customer_report_id=cr.customer_report_id;
 ELSE RAISE EXCEPTION 'Unknown action.';
 END IF;
 RETURN jsonb_build_object('id',id,'message','Saved successfully.');
END $$;
CREATE FUNCTION public.mis_command(action text,a jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT private.mis_command(action,a) $$;
REVOKE ALL ON FUNCTION public.mis_command(text,jsonb) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.mis_command(text,jsonb) TO authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.current_role(),private.can_store(bigint),private.can_product(bigint),private.can_price(bigint),private.mis_command(text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION private.public_listings(text) TO anon,authenticated;
-- Every foreign key has a leading-column index for predictable reviews and deletes.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT t.relname table_name,a.attname column_name FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace ns ON ns.oid=t.relnamespace JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=c.conkey[1] WHERE c.contype='f' AND ns.nspname='public' LOOP
 EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(%I)',r.table_name||'_'||r.column_name||'_fk',r.table_name,r.column_name);
 END LOOP;
END $$;
