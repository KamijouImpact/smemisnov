CREATE FUNCTION private.record_stock(a jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid; sp public.store_product; u public.product_unit; opt public.store_price; old public.stock_transaction; t public.stock_transaction; q integer; expected numeric; cost numeric; effective numeric; history bigint; promo bigint;
BEGIN
 uid:=private.require_role(ARRAY['Owner']); sp:=private.own_product((a->>'store_product_id')::bigint);
 t.store_product_id:=sp.store_product_id; t.recorded_by:=uid; t.recorded_at:=now(); t.transaction_type:=a->>'transaction_type'; t.reason:=nullif(trim(a->>'reason'),'');
 IF t.transaction_type IN ('Loss','Spoilage','Damage','Correction','Reversal') THEN t.reason:=private.required(t.reason,'reason'); END IF;
 IF t.transaction_type IN ('Opening','Restock','Sale') THEN
 SELECT * INTO STRICT u FROM public.product_unit WHERE unit_id=(a->>'unit_id')::bigint AND variation_id=sp.variation_id AND status='Active';
 q:=(a->>'entered_quantity')::integer; IF q IS NULL OR q<1 OR q>1000000 THEN RAISE EXCEPTION 'Enter a whole quantity from 1 to 1000000.'; END IF;
 t.unit_id:=u.unit_id; t.entered_quantity:=q; t.units_per_package:=u.stock_units; t.quantity_change:=q*u.stock_units;
 IF t.transaction_type='Sale' THEN
 SELECT * INTO STRICT opt FROM public.store_price WHERE store_product_id=sp.store_product_id AND unit_id=u.unit_id AND status='Active' AND regular_price IS NOT NULL;
 IF NOT private.active_option(opt.store_price_id) THEN RAISE EXCEPTION 'This selling option is not active.'; END IF;
 SELECT price_history_id INTO STRICT history FROM public.price_history WHERE store_price_id=opt.store_price_id ORDER BY price_history_id DESC LIMIT 1;
 SELECT e.promotion_entry_id,e.promotion_price INTO promo,effective FROM public.promotion_entry e JOIN public.promotion p USING(promotion_id) WHERE e.store_price_id=opt.store_price_id AND e.status='Approved' AND p.status='Open' AND now()>=p.starts_at AND now()<p.ends_at AND e.promotion_price<opt.regular_price ORDER BY e.promotion_entry_id DESC LIMIT 1;
 expected:=coalesce(effective,opt.regular_price)*q;
 t.total_sale_amount:=CASE WHEN nullif(a->>'total_sale_amount','') IS NULL THEN private.money(expected::text) ELSE private.money(a->>'total_sale_amount') END;
 IF t.total_sale_amount<>expected AND t.reason IS NULL THEN RAISE EXCEPTION 'The charge differs from the listed price. Enter a reason.'; END IF;
 t.quantity_change:=-t.quantity_change; t.unit_purchase_cost:=sp.latest_unit_cost; t.price_history_id:=history; t.promotion_entry_id:=promo;
 ELSE
 IF t.transaction_type='Opening' AND EXISTS(SELECT 1 FROM public.stock_transaction WHERE store_product_id=sp.store_product_id) THEN RAISE EXCEPTION 'Opening stock must be the first movement.'; END IF;
 IF nullif(a->>'total_purchase_cost','') IS NOT NULL THEN t.total_purchase_cost:=private.money(a->>'total_purchase_cost',true); t.unit_purchase_cost:=round(t.total_purchase_cost/t.quantity_change,6); END IF;
 END IF;
 ELSIF t.transaction_type IN ('Loss','Spoilage','Damage') THEN
 q:=(a->>'quantity_change')::integer; IF q IS NULL OR q<1 THEN RAISE EXCEPTION 'Enter the stock units removed.'; END IF; t.quantity_change:=-q;
 ELSIF t.transaction_type='Correction' THEN
 t.quantity_change:=(a->>'quantity_change')::integer; t.unit_purchase_cost:=nullif(a->>'unit_purchase_cost','')::numeric;
 IF t.unit_purchase_cost IS NOT NULL AND (t.unit_purchase_cost<0 OR t.unit_purchase_cost>1000000000 OR t.unit_purchase_cost::text IN ('NaN','Infinity','-Infinity') OR t.unit_purchase_cost<>round(t.unit_purchase_cost,6)) THEN RAISE EXCEPTION 'Enter a valid unit cost with up to six decimals.'; END IF;
 IF t.quantity_change IS NULL OR (t.quantity_change=0 AND t.unit_purchase_cost IS NULL) THEN RAISE EXCEPTION 'Enter a signed stock change or corrected unit cost.'; END IF;
 t.correction_of_id:=nullif(a->>'correction_of_id','')::bigint;
 IF t.correction_of_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.stock_transaction WHERE stock_transaction_id=t.correction_of_id AND store_product_id=sp.store_product_id) THEN RAISE EXCEPTION 'The earlier movement must belong to this product.'; END IF;
 ELSIF t.transaction_type='Reversal' THEN
 SELECT * INTO STRICT old FROM public.stock_transaction WHERE stock_transaction_id=(a->>'correction_of_id')::bigint AND store_product_id=sp.store_product_id;
 IF old.transaction_type='Reversal' THEN RAISE EXCEPTION 'A reversal cannot reverse another reversal.'; END IF;
 t.correction_of_id:=old.stock_transaction_id; t.quantity_change:=-old.quantity_change;
 t.unit_id:=old.unit_id;t.entered_quantity:=old.entered_quantity;t.units_per_package:=old.units_per_package;
 t.unit_purchase_cost:=old.unit_purchase_cost;t.price_history_id:=old.price_history_id;t.promotion_entry_id:=old.promotion_entry_id;
 t.total_sale_amount:=-old.total_sale_amount;t.total_purchase_cost:=-old.total_purchase_cost;
 ELSE RAISE EXCEPTION 'Choose a valid stock transaction.';
 END IF;
 IF abs(t.quantity_change)>100000000 OR sp.stock_quantity::bigint+t.quantity_change NOT BETWEEN 0 AND 1000000000 THEN RAISE EXCEPTION 'The movement would cause an invalid stock balance.'; END IF;
 INSERT INTO public.stock_transaction(store_product_id,recorded_by,transaction_type,quantity_change,unit_id,entered_quantity,units_per_package,total_purchase_cost,total_sale_amount,unit_purchase_cost,price_history_id,promotion_entry_id,correction_of_id,reason,recorded_at)
 VALUES(t.store_product_id,t.recorded_by,t.transaction_type,t.quantity_change,t.unit_id,t.entered_quantity,t.units_per_package,t.total_purchase_cost,t.total_sale_amount,t.unit_purchase_cost,t.price_history_id,t.promotion_entry_id,t.correction_of_id,t.reason,t.recorded_at) RETURNING stock_transaction_id INTO t.stock_transaction_id;
 SELECT x.unit_purchase_cost INTO cost FROM public.stock_transaction x WHERE x.store_product_id=sp.store_product_id AND (x.transaction_type IN ('Opening','Restock') OR (x.transaction_type='Correction' AND x.unit_purchase_cost IS NOT NULL)) AND NOT EXISTS(SELECT 1 FROM public.stock_transaction rev WHERE rev.transaction_type='Reversal' AND rev.correction_of_id=x.stock_transaction_id) ORDER BY x.stock_transaction_id DESC LIMIT 1;
 UPDATE public.store_product SET stock_quantity=sp.stock_quantity+t.quantity_change,latest_unit_cost=cost WHERE store_product_id=sp.store_product_id;
 RETURN jsonb_build_object('id',t.stock_transaction_id,'message','Stock movement recorded.');
END $$;
