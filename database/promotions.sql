CREATE FUNCTION private.promotion_action(action text,a jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid; p public.promotion; e public.promotion_entry; opt public.store_price; hist bigint; id bigint; discount numeric; decision text; prior bigint;
BEGIN
 uid:=private.require_role(ARRAY['Administrator','Owner']); PERFORM pg_advisory_xact_lock(731901);
 IF action='promotion' THEN
 PERFORM private.require_role(ARRAY['Administrator']);
 INSERT INTO public.promotion(promotion_name,description,starts_at,ends_at,created_by) VALUES(private.required(a->>'promotion_name','event name'),nullif(trim(a->>'description'),''),(a->>'starts_at')::timestamptz,(a->>'ends_at')::timestamptz,uid) RETURNING promotion_id INTO id;
 ELSIF action='cancel_promotion' THEN
 PERFORM private.require_role(ARRAY['Administrator']); UPDATE public.promotion SET status='Cancelled' WHERE promotion_id=(a->>'promotion_id')::bigint;
 ELSIF action='promotion_entry' THEN
 opt:=private.own_option((a->>'store_price_id')::bigint);
 SELECT * INTO STRICT p FROM public.promotion WHERE promotion_id=(a->>'promotion_id')::bigint AND status='Open' AND ends_at>now();
 discount:=private.money(a->>'promotion_price');
 IF opt.regular_price IS NULL OR discount>=opt.regular_price THEN RAISE EXCEPTION 'The promotion price must be below the approved regular price.'; END IF;
 SELECT price_history_id INTO STRICT hist FROM public.price_history WHERE store_price_id=opt.store_price_id ORDER BY price_history_id DESC LIMIT 1;
 prior:=nullif(a->>'previous_entry_id','')::bigint;
 IF prior IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.promotion_entry WHERE promotion_entry_id=prior AND store_price_id=opt.store_price_id AND promotion_id=p.promotion_id AND status IN ('Rejected','Withdrawn')) THEN RAISE EXCEPTION 'Choose an earlier rejected or withdrawn entry for this event and listing.'; END IF;
 INSERT INTO public.promotion_entry(promotion_id,store_price_id,submitted_by,submitted_at,promotion_price,regular_history_id,previous_entry_id) VALUES(p.promotion_id,opt.store_price_id,uid,now(),discount,hist,prior) RETURNING promotion_entry_id INTO id;
 ELSIF action IN ('review_promotion','withdraw_promotion') THEN
 SELECT * INTO STRICT e FROM public.promotion_entry WHERE promotion_entry_id=(a->>'promotion_entry_id')::bigint FOR UPDATE;
 SELECT * INTO STRICT opt FROM public.store_price WHERE store_price_id=e.store_price_id FOR UPDATE;
 SELECT * INTO STRICT p FROM public.promotion WHERE promotion_id=e.promotion_id;
 IF action='withdraw_promotion' THEN
 PERFORM private.own_option(opt.store_price_id); IF e.status NOT IN ('Pending','Approved') THEN RAISE EXCEPTION 'This entry cannot be withdrawn.'; END IF;
 UPDATE public.promotion_entry SET status='Withdrawn',decision_reason=concat_ws(' | ',decision_reason,'Owner withdrew: '||private.required(a->>'decision_reason','withdrawal reason')) WHERE promotion_entry_id=e.promotion_entry_id;
 ELSE
 PERFORM private.require_role(ARRAY['Administrator']);
 IF e.status<>'Pending' THEN RAISE EXCEPTION 'This entry is already decided.'; END IF;
 decision:=a->>'decision'; IF decision NOT IN ('Approved','Rejected') THEN RAISE EXCEPTION 'Choose Approved or Rejected.'; END IF;
 IF decision='Approved' THEN
 IF NOT private.active_option(opt.store_price_id) OR p.status<>'Open' OR p.ends_at<=now() OR e.promotion_price>=opt.regular_price THEN RAISE EXCEPTION 'The event or price is no longer valid.'; END IF;
 SELECT price_history_id INTO hist FROM public.price_history WHERE store_price_id=opt.store_price_id ORDER BY price_history_id DESC LIMIT 1;
 IF hist<>e.regular_history_id THEN RAISE EXCEPTION 'The regular price changed. Ask the Owner to resubmit.'; END IF;
 IF EXISTS(SELECT 1 FROM public.promotion_entry x JOIN public.promotion xp USING(promotion_id) WHERE x.store_price_id=opt.store_price_id AND x.status='Approved' AND xp.status='Open' AND xp.starts_at<p.ends_at AND xp.ends_at>p.starts_at) THEN RAISE EXCEPTION 'Another approved promotion overlaps this event.'; END IF;
 END IF;
 UPDATE public.promotion_entry SET status=decision,reviewed_by=uid,decided_at=now(),decision_reason=private.required(a->>'decision_reason','decision reason') WHERE promotion_entry_id=e.promotion_entry_id;
 END IF;
 ELSE RAISE EXCEPTION 'Unknown promotion action.'; END IF;
 RETURN jsonb_build_object('id',id,'message','Promotion record saved.');
END $$;
