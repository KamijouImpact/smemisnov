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
 IF count_sources>=rule.minimum_stores THEN
  SELECT avg(x.new_price) INTO median FROM (
  SELECT h.new_price,row_number() OVER(ORDER BY h.new_price) rank FROM public.price_reference r JOIN public.price_history h USING(price_history_id) WHERE r.price_request_id=id
  ) x WHERE x.rank IN ((count_sources+1)/2,(count_sources+2)/2);
  cutoff:=floor(median*(1+rule.allowance_percent/100)*100)/100;
 END IF;
 reason:=CASE WHEN NOT reliable THEN 'Unreliable Product Match' WHEN rule.rule_id IS NULL THEN 'No Active Rule' WHEN count_sources<rule.minimum_stores THEN 'Too Few References' WHEN proposal>cutoff THEN 'Above Reference' ELSE NULL END;
 UPDATE public.price_request SET reference_count=count_sources,reference_median=median,allowed_price=cutoff,review_reason=reason WHERE price_request_id=id;
 IF reason IS NULL THEN PERFORM private.activate_price(id,'System',NULL,'Within the current price rule.'); END IF;
 RETURN jsonb_build_object('id',id,'message',CASE WHEN reason IS NULL THEN 'Price approved.' ELSE 'Pending Price Review: '||reason||'. Your current approved price stays in use.' END);
END $$;
CREATE FUNCTION private.review_price(a jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
