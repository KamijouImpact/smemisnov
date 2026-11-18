CREATE FUNCTION private.require_role(allowed text[]) RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(private.current_role()=ANY(allowed),false) THEN RAISE EXCEPTION 'You do not have access to this action.'; END IF;
 RETURN auth.uid();
END $$;
CREATE FUNCTION private.required(value text,label text) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN IF trim(coalesce(value,''))='' OR length(value)>4000 THEN RAISE EXCEPTION 'Enter a valid % (up to 4000 characters).',label; END IF; RETURN trim(value); END $$;
CREATE FUNCTION private.money(value text,allow_zero boolean DEFAULT false) RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE n numeric; BEGIN
 n:=value::numeric;
 IF n IS NULL OR n::text IN ('NaN','Infinity','-Infinity') OR n<0 OR (n=0 AND NOT allow_zero) OR n>1000000000 OR n<>round(n,2) THEN RAISE EXCEPTION 'Enter an amount with at most two decimal places.'; END IF;
 RETURN n;
END $$;
CREATE FUNCTION private.own_store(id bigint) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 PERFORM private.require_role(ARRAY['Owner']);
 IF NOT EXISTS(SELECT 1 FROM public.sme WHERE sme_id=id AND owner_id=auth.uid() AND status='Active') THEN RAISE EXCEPTION 'Choose your active store.'; END IF;
END $$;
CREATE FUNCTION private.own_product(id bigint) RETURNS public.store_product LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE sp public.store_product; BEGIN
 SELECT * INTO STRICT sp FROM public.store_product WHERE store_product_id=id FOR UPDATE;
 PERFORM private.own_store(sp.sme_id);
 IF sp.status<>'Active' OR NOT EXISTS(SELECT 1 FROM public.product_variation v JOIN public.product p USING(product_id) JOIN public.category c USING(category_id) LEFT JOIN public.brand b USING(brand_id) WHERE v.variation_id=sp.variation_id AND v.status='Active' AND p.status='Active' AND c.status='Active' AND (b.brand_id IS NULL OR b.status='Active')) THEN RAISE EXCEPTION 'This product is not active.'; END IF;
 RETURN sp;
END $$;
CREATE FUNCTION private.own_option(id bigint) RETURNS public.store_price LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE opt public.store_price; sp public.store_product; BEGIN
 SELECT * INTO STRICT opt FROM public.store_price WHERE store_price_id=id FOR UPDATE;
 sp:=private.own_product(opt.store_product_id);
 IF NOT private.active_option(id) THEN RAISE EXCEPTION 'Choose an active product and selling unit.'; END IF;
 RETURN opt;
END $$;
CREATE FUNCTION private.activate_price(id bigint,source text,reviewer uuid,reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.price_request; p public.store_price; BEGIN
 SELECT * INTO STRICT r FROM public.price_request WHERE price_request_id=id FOR UPDATE;
 SELECT * INTO STRICT p FROM public.store_price WHERE store_price_id=r.store_price_id FOR UPDATE;
 IF r.status<>'Pending Price Review' OR NOT private.active_option(p.store_price_id) THEN RAISE EXCEPTION 'This request or listing is no longer active.'; END IF;
 IF p.regular_price IS DISTINCT FROM r.previous_price THEN RAISE EXCEPTION 'The current price changed. Submit a new request.'; END IF;
 UPDATE public.price_request SET status='Approved',decision_source=source,reviewed_by=reviewer,decided_at=now(),decision_reason=reason WHERE price_request_id=id;
 UPDATE public.store_price SET regular_price=r.proposed_price,price_updated_at=now() WHERE store_price_id=p.store_price_id;
 INSERT INTO public.price_history(store_price_id,price_request_id,old_price,new_price,effective_at) VALUES(p.store_price_id,id,p.regular_price,r.proposed_price,now());
END $$;
