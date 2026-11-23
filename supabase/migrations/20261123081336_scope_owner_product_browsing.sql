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
 AND (
  NOT (SELECT EXISTS (
   SELECT 1 FROM public.user_account a
   WHERE a.user_id=(SELECT auth.uid()) AND a.role='Owner'
  ))
  OR private.can_store(sm.sme_id)
 )
 AND concat_ws(' ',p.product_name,p.model_or_style,coalesce(p.store_brand_name,b.brand_name),v.variation_name,v.size,v.color,v.flavor,v.capacity,u.unit_name,sm.store_name,c.category_name) ILIKE '%'||left(search,120)||'%'
 ) x
$$;
