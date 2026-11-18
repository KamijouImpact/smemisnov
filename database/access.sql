CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM public, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, anon;

CREATE FUNCTION private.current_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT role FROM public.user_account WHERE user_id=auth.uid() AND status='Active'
$$;
CREATE FUNCTION private.can_store(id bigint) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT coalesce(private.current_role()='Administrator' OR (private.current_role()='Owner' AND EXISTS(SELECT 1 FROM public.sme WHERE sme_id=id AND owner_id=auth.uid())),false)
$$;
CREATE FUNCTION private.can_product(id bigint) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.store_product WHERE store_product_id=id AND private.can_store(sme_id))
$$;
CREATE FUNCTION private.can_price(id bigint) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.store_price WHERE store_price_id=id AND private.can_product(store_product_id))
$$;
CREATE FUNCTION private.new_account() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 INSERT INTO public.user_account(user_id,role,full_name,login_name,status,created_at)
 VALUES(new.id,'Customer',left(coalesce(nullif(new.raw_user_meta_data->>'full_name',''),'New account'),120),new.email,'Active',now());
 RETURN new;
END $$;
CREATE TRIGGER create_mis_account AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION private.new_account();
INSERT INTO public.user_account(user_id,role,full_name,login_name,status,created_at)
 SELECT id,'Customer',coalesce(nullif(raw_user_meta_data->>'full_name',''),'New account'),email,'Active',created_at FROM auth.users;

-- No client can insert/update/delete business tables. Commands below validate each transition.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['user_account','sme','category','brand','product','product_variation','product_unit','product_request','store_product','store_price','price_rule','price_request','price_reference','price_history','stock_transaction','promotion','promotion_entry','customer_report'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t);
 EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
 END LOOP;
END $$;
CREATE POLICY account_read ON user_account FOR SELECT TO authenticated USING(user_id=(select auth.uid()) OR (select private.current_role())='Administrator');
CREATE POLICY store_read ON sme FOR SELECT TO authenticated USING(private.can_store(sme_id));
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['category','brand','product','product_variation','product_unit','promotion'] LOOP
 EXECUTE format('CREATE POLICY catalog_read ON public.%I FOR SELECT TO authenticated USING ((select private.current_role()) IN (''Administrator'', ''Owner''))',t);
 END LOOP;
END $$;
CREATE POLICY product_request_read ON product_request FOR SELECT TO authenticated USING(private.can_store(sme_id));
CREATE POLICY store_product_read ON store_product FOR SELECT TO authenticated USING(private.can_store(sme_id));
CREATE POLICY store_price_read ON store_price FOR SELECT TO authenticated USING(private.can_product(store_product_id));
CREATE POLICY price_request_read ON price_request FOR SELECT TO authenticated USING(private.can_price(store_price_id));
CREATE POLICY price_rule_read ON price_rule FOR SELECT TO authenticated USING((select private.current_role())='Administrator');
CREATE POLICY reference_read ON price_reference FOR SELECT TO authenticated USING((select private.current_role())='Administrator');
CREATE POLICY history_read ON price_history FOR SELECT TO authenticated USING(private.can_price(store_price_id));
CREATE POLICY transaction_read ON stock_transaction FOR SELECT TO authenticated USING(private.can_product(store_product_id));
CREATE POLICY entry_read ON promotion_entry FOR SELECT TO authenticated USING(private.can_price(store_price_id));
CREATE POLICY report_read ON customer_report FOR SELECT TO authenticated USING((customer_id=(select auth.uid()) AND (select private.current_role()) IS NOT NULL) OR private.can_price(store_price_id));

CREATE FUNCTION private.active_option(id bigint) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.store_price s
 JOIN public.store_product sp USING(store_product_id) JOIN public.sme sm USING(sme_id)
 JOIN public.user_account a ON a.user_id=sm.owner_id JOIN public.product_variation v USING(variation_id)
 JOIN public.product p USING(product_id) JOIN public.category c USING(category_id)
 LEFT JOIN public.brand b USING(brand_id) JOIN public.product_unit u ON u.unit_id=s.unit_id AND u.variation_id=v.variation_id
 WHERE s.store_price_id=id AND s.status='Active' AND sp.status='Active' AND sm.status='Active' AND a.status='Active'
 AND v.status='Active' AND p.status='Active' AND c.status='Active' AND (b.brand_id IS NULL OR b.status='Active') AND u.status='Active')
$$;
CREATE FUNCTION private.public_listings(search text DEFAULT '') RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT coalesce(jsonb_agg(x ORDER BY x.product_name,x.store_name,x.store_price_id),'[]'::jsonb) FROM (
 SELECT s.store_price_id,sm.store_name,sm.business_type,sm.address,p.product_name,p.model_or_style,c.category_name,c.product_type,b.brand_name,
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
 AND concat_ws(' ',p.product_name,p.model_or_style,b.brand_name,v.variation_name,v.size,v.color,v.flavor,v.capacity,u.unit_name,sm.store_name,c.category_name) ILIKE '%'||left(search,120)||'%'
 ) x
$$;
CREATE FUNCTION public.browse_products(search text DEFAULT '') RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$ SELECT private.public_listings(search) $$;
REVOKE ALL ON FUNCTION public.browse_products(text) FROM public;
GRANT EXECUTE ON FUNCTION public.browse_products(text) TO anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.current_role(),private.can_store(bigint),private.can_product(bigint),private.can_price(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION private.public_listings(text) TO anon,authenticated;
