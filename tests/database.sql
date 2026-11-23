-- Transactional integration tests. Every fixture and change is rolled back.
BEGIN;
DO $$
DECLARE admin_id uuid:=gen_random_uuid(); owner_a uuid:=gen_random_uuid(); owner_b uuid:=gen_random_uuid(); owner_c uuid:=gen_random_uuid(); customer_id uuid:=gen_random_uuid();
 cat bigint; brand bigint; prod bigint; var bigint; piece bigint; box bigint; store_a bigint; store_b bigint; store_c bigint; pa bigint; pb bigint; pc bigint; stock_a bigint; req bigint; req2 bigint; tx bigint; rev bigint; event bigint; entry bigint; report bigint; no_reply_report bigint; result jsonb;
 tea_a bigint; tea_b bigint; tea_c bigint; tea_conflict bigint; tea_request bigint;
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(admin_id,admin_id||'@example.test','{}'),(owner_a,owner_a||'@example.test','{}'),(owner_b,owner_b||'@example.test','{}'),(owner_c,owner_c||'@example.test','{}'),(customer_id,customer_id||'@example.test','{}');
 UPDATE public.user_account SET role='Administrator' WHERE user_id=admin_id;
 UPDATE public.user_account SET role='Owner' WHERE user_id IN(owner_a,owner_b,owner_c);
 PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
 cat:=(public.mis_command('category','{"category_name":"Integration goods","product_type":"Packaged Product"}') ->>'id')::bigint;
 brand:=(public.mis_command('brand','{"brand_name":"Néstle Integration"}') ->>'id')::bigint;
 BEGIN PERFORM public.mis_command('brand','{"brand_name":"nestle integration"}');RAISE EXCEPTION 'Expected duplicate-brand refusal';EXCEPTION WHEN unique_violation THEN NULL;END;
 prod:=(public.mis_command('product',jsonb_build_object('category_id',cat,'brand_id',brand,'product_name','Test sardines')) ->>'id')::bigint;
 ASSERT (SELECT status='Draft' FROM public.product WHERE product_id=prod),'Product is draft before an active variant and unit exist';
 var:=(public.mis_command('variation',jsonb_build_object('product_id',prod,'stock_unit','can','condition','New','net_quantity','0.155','net_unit','kg','allow_price_reference',true)) ->>'id')::bigint;
 ASSERT (SELECT net_quantity=155 AND net_unit='g' AND variation_name='Standard' FROM public.product_variation WHERE variation_id=var),'Normalized grams and default Standard variation';
 piece:=(public.mis_command('unit',jsonb_build_object('variation_id',var,'unit_name','can','stock_units',1)) ->>'id')::bigint;
 ASSERT (SELECT status='Active' FROM public.product WHERE product_id=prod),'First active unit activates draft product';
 BEGIN
  PERFORM public.mis_command('catalog_status',jsonb_build_object('table','product_unit','id',piece,'status','Archived'));
  RAISE EXCEPTION 'Expected last active unit archive refusal';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'An active product needs an active option and pack size.%' THEN RAISE; END IF;
 END;
 box:=(public.mis_command('unit',jsonb_build_object('variation_id',var,'unit_name','box of 24','stock_units',24)) ->>'id')::bigint;
 PERFORM set_config('request.jwt.claim.sub',owner_a::text,true);
 store_a:=(public.mis_command('store','{"store_name":"Test A","business_type":"General retail","address":"Test"}') ->>'id')::bigint;
 BEGIN
  PERFORM public.mis_command('store','{"store_name":"Duplicate","business_type":"General retail","address":"Test"}');
  RAISE EXCEPTION 'Expected second store registration refusal';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'This Owner already has a registered store.' THEN RAISE; END IF;
 END;
 PERFORM set_config('request.jwt.claim.sub',owner_b::text,true);
 store_b:=(public.mis_command('store','{"store_name":"Test B","business_type":"General retail","address":"Test"}') ->>'id')::bigint;
 PERFORM set_config('request.jwt.claim.sub',owner_c::text,true);
 store_c:=(public.mis_command('store','{"store_name":"Test C","business_type":"General retail","address":"Test"}') ->>'id')::bigint;
 PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
 PERFORM public.mis_command('store_status',jsonb_build_object('sme_id',store_a,'status','Active'));PERFORM public.mis_command('store_status',jsonb_build_object('sme_id',store_b,'status','Active'));PERFORM public.mis_command('store_status',jsonb_build_object('sme_id',store_c,'status','Active'));
 PERFORM set_config('request.jwt.claim.sub',owner_a::text,true);
 stock_a:=(public.mis_command('list_unit',jsonb_build_object('sme_id',store_a,'unit_id',piece))->>'id')::bigint;
 PERFORM public.mis_command('list_unit',jsonb_build_object('sme_id',store_a,'unit_id',box));
 SELECT store_price_id INTO pa FROM public.store_price WHERE store_product_id=stock_a AND unit_id=piece;
 req:=(public.mis_command('submit_price',jsonb_build_object('store_price_id',pa,'proposed_price','20'))->>'id')::bigint;
 ASSERT (SELECT status='Pending Price Review' AND review_reason='No Active Rule' FROM public.price_request WHERE price_request_id=req),'Initial price manual review';
 ASSERT NOT EXISTS(SELECT 1 FROM public.store_price WHERE store_price_id=pa AND regular_price IS NOT NULL),'Initial pending price hidden';
 BEGIN PERFORM public.mis_command('review_price',jsonb_build_object('price_request_id',req,'decision','Approved','decision_reason','Self approval'));RAISE EXCEPTION 'Expected Owner review refusal';EXCEPTION WHEN others THEN IF SQLERRM='Expected Owner review refusal' THEN RAISE;END IF;END;
 PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
 PERFORM public.mis_command('review_price',jsonb_build_object('price_request_id',req,'decision','Approved','decision_reason','Initial review.'));
 PERFORM public.mis_command('rule','{"allowance_percent":"10","minimum_stores":"2","maximum_age_days":"30"}');
 PERFORM set_config('request.jwt.claim.sub',owner_b::text,true);
 PERFORM public.mis_command('list_unit',jsonb_build_object('sme_id',store_b,'unit_id',piece));
 SELECT s.store_price_id INTO pb FROM public.store_price s JOIN public.store_product sp USING(store_product_id) WHERE sp.sme_id=store_b AND s.unit_id=piece;
 req:=(public.mis_command('submit_price',jsonb_build_object('store_price_id',pb,'proposed_price','22'))->>'id')::bigint;
 ASSERT (SELECT status='Pending Price Review' AND review_reason='Too Few References' FROM public.price_request WHERE price_request_id=req),'One external reference is below the configured minimum';
 ASSERT (SELECT policy_snapshot->>'reference_count'='1' AND policy_snapshot->>'median_price' IS NULL AND policy_snapshot->>'allowed_price' IS NULL FROM public.price_request_evidence WHERE price_request_id=req),'One reference is retained without median or cutoff below the minimum';
 PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);PERFORM public.mis_command('review_price',jsonb_build_object('price_request_id',req,'decision','Approved','decision_reason','Initial review.'));
 PERFORM set_config('request.jwt.claim.sub',owner_c::text,true);PERFORM public.mis_command('list_unit',jsonb_build_object('sme_id',store_c,'unit_id',piece));
 SELECT s.store_price_id INTO pc FROM public.store_price s JOIN public.store_product sp USING(store_product_id) WHERE sp.sme_id=store_c AND s.unit_id=piece;
 req:=(public.mis_command('submit_price',jsonb_build_object('store_price_id',pc,'proposed_price','23.10'))->>'id')::bigint;
 ASSERT (SELECT status='Approved' AND decision_source='System' FROM public.price_request WHERE price_request_id=req),'Legacy exact comparison still auto-approves under configured policy';
 ASSERT (SELECT (policy_snapshot->>'median_price')::numeric=21 AND policy_snapshot->>'reference_count'='2' AND (policy_snapshot->>'allowed_price')::numeric=23.10 FROM public.price_request_evidence WHERE price_request_id=req),'Configured exact-source median and cutoff are retained privately';
 ASSERT (SELECT count(*)=1 FROM public.price_history WHERE price_request_id=req),'Exactly one history row';
 req:=(public.mis_command('submit_price',jsonb_build_object('store_price_id',pc,'proposed_price','40'))->>'id')::bigint;
 ASSERT (SELECT review_reason='Above Reference' AND status='Pending Price Review' FROM public.price_request WHERE price_request_id=req),'Large increase holds';
 ASSERT (SELECT regular_price=23.10 FROM public.store_price WHERE store_price_id=pc),'Approved price stays pending';
 PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
 BEGIN PERFORM public.mis_command('review_price',jsonb_build_object('price_request_id',req,'decision','Approved','decision_reason','Review'));RAISE EXCEPTION 'Expected explanation requirement';EXCEPTION WHEN others THEN IF SQLERRM='Expected explanation requirement' THEN RAISE;END IF;END;
 PERFORM set_config('request.jwt.claim.sub',owner_c::text,true);PERFORM public.mis_command('price_explanation',jsonb_build_object('price_request_id',req,'owner_reason','Higher transport and spoilage expenses.'));
 PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);PERFORM public.mis_command('review_price',jsonb_build_object('price_request_id',req,'decision','Rejected','decision_reason','Correct the package and supporting details.'));
 PERFORM set_config('request.jwt.claim.sub',owner_c::text,true);
 req2:=(public.mis_command('submit_price',jsonb_build_object('store_price_id',pc,'proposed_price','23','previous_request_id',req,'owner_reason','Corrected price.'))->>'id')::bigint;
 ASSERT (SELECT previous_request_id=req AND status='Approved' FROM public.price_request WHERE price_request_id=req2),'Rejected request corrected and linked';
 -- A fixed box is not compared with pieces. High markup is reviewed, not automatically branded excessive.
 PERFORM set_config('request.jwt.claim.sub',owner_a::text,true);
 SELECT store_price_id INTO req2 FROM public.store_price WHERE store_product_id=stock_a AND unit_id=box;
 req:=(public.mis_command('submit_price',jsonb_build_object('store_price_id',req2,'proposed_price','500','owner_reason','Transport, storage, and spoilage costs.'))->>'id')::bigint;
 ASSERT (SELECT review_reason='Too Few References' FROM public.price_request WHERE price_request_id=req),'Different packages cannot fill the automatic rule threshold';
 ASSERT (SELECT snapshot->>'reference_count'='0' FROM public.price_request_evidence WHERE price_request_id=req),'Different packages excluded from observed evidence';
 BEGIN PERFORM public.mis_command('submit_price',jsonb_build_object('store_price_id',req2,'proposed_price','501'));RAISE EXCEPTION 'Expected duplicate pending refusal';EXCEPTION WHEN unique_violation THEN NULL;END;
 PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
 PERFORM public.mis_command('review_price',jsonb_build_object('price_request_id',req,'decision','Approved','decision_reason','Expenses and exact package checked; markup alone is not proof.'));
 ASSERT (SELECT regular_price=500 FROM public.store_price WHERE store_price_id=req2),'Supported high price can be approved';
 -- Fixed packages share one balance. Sale and reversal retain original amounts and conversions.
 PERFORM set_config('request.jwt.claim.sub',owner_a::text,true);
 tx:=(public.mis_command('stock',jsonb_build_object('store_product_id',stock_a,'transaction_type','Opening','unit_id',box,'entered_quantity','2','total_purchase_cost','480'))->>'id')::bigint;
 ASSERT (SELECT stock_quantity=48 AND latest_unit_cost=10 FROM public.store_product WHERE store_product_id=stock_a),'Box conversion and cost';
 tx:=(public.mis_command('stock',jsonb_build_object('store_product_id',stock_a,'transaction_type','Sale','unit_id',piece,'entered_quantity','3'))->>'id')::bigint;
 ASSERT (SELECT quantity_change=-3 AND total_sale_amount=60 AND unit_purchase_cost=10 AND units_per_package=1 FROM public.stock_transaction WHERE stock_transaction_id=tx),'Sale snapshots';
 BEGIN PERFORM public.mis_command('stock',jsonb_build_object('store_product_id',stock_a,'transaction_type','Sale','unit_id',piece,'entered_quantity','100'));RAISE EXCEPTION 'Expected negative stock refusal';EXCEPTION WHEN others THEN IF SQLERRM='Expected negative stock refusal' THEN RAISE;END IF;END;
 rev:=(public.mis_command('stock',jsonb_build_object('store_product_id',stock_a,'transaction_type','Reversal','correction_of_id',tx,'reason','Duplicate sale'))->>'id')::bigint;
 ASSERT (SELECT stock_quantity=48 FROM public.store_product WHERE store_product_id=stock_a),'Reversal restores stock';
 BEGIN PERFORM public.mis_command('stock',jsonb_build_object('store_product_id',stock_a,'transaction_type','Reversal','correction_of_id',tx,'reason','Again'));RAISE EXCEPTION 'Expected duplicate reversal refusal';EXCEPTION WHEN unique_violation THEN NULL;END;
 PERFORM public.mis_command('stock',jsonb_build_object('store_product_id',stock_a,'transaction_type','Correction','quantity_change','0','unit_purchase_cost','11','reason','Correct cost'));
 ASSERT (SELECT unit_purchase_cost=10 FROM public.stock_transaction WHERE stock_transaction_id=tx),'Earlier sale cost unchanged';
 -- Other / Not Listed must be reviewed and resolved to an approved selling unit.
 req:=(public.mis_command('product_request',jsonb_build_object('sme_id',store_a,'requested_details','Existing can, alternate spelling'))->>'id')::bigint;
 PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
 BEGIN
  PERFORM public.mis_command('review_product',jsonb_build_object('product_request_id',req,'decision','Approved','decision_reason','Missing pack'));
  RAISE EXCEPTION 'Expected approval without a pack to be rejected';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'Choose an exact matching pack size before approving.' THEN RAISE; END IF;
 END;
 PERFORM public.mis_command('review_product',jsonb_build_object('product_request_id',req,'decision','Approved','unit_id',piece,'decision_reason','Matched existing details.'));
 ASSERT (SELECT status='Approved' AND approved_unit_id=piece FROM public.product_request WHERE product_request_id=req),'Catalog match reviewed';
 event:=(public.mis_command('promotion',jsonb_build_object('promotion_name','Test event','starts_at',now()-interval '1 hour','ends_at',now()+interval '1 day'))->>'id')::bigint;
 PERFORM set_config('request.jwt.claim.sub',owner_a::text,true);
 entry:=(public.mis_command('promotion_entry',jsonb_build_object('promotion_id',event,'store_price_id',pa,'promotion_price','18'))->>'id')::bigint;
 PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);PERFORM public.mis_command('review_promotion',jsonb_build_object('promotion_entry_id',entry,'decision','Approved','decision_reason','Approved event discount.'));
 ASSERT EXISTS(SELECT 1 FROM jsonb_array_elements(public.browse_products('Test sardines')) r WHERE (r->>'store_price_id')::bigint=pa AND (r->>'selling_price')::numeric=18),'Approved promotion public';
 ASSERT NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.browse_products('')) r WHERE r?'latest_unit_cost' OR r?'stock_quantity' OR r?'owner_id'),'Public fields sanitized';
 PERFORM set_config('request.jwt.claim.sub',customer_id::text,true);
 report:=(public.mis_command('customer_report',jsonb_build_object('store_price_id',pa,'listed_price','18','charged_price','20','description','Charged more than the listed promotion','evidence_reference','Receipt reference'))->>'id')::bigint;
 no_reply_report:=(public.mis_command('customer_report',jsonb_build_object('store_price_id',pa,'listed_price','18','description','No receipt available'))->>'id')::bigint;
 BEGIN
  PERFORM public.mis_command('request_report_response',jsonb_build_object('customer_report_id',report));
  RAISE EXCEPTION 'Expected Customer response request refusal';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'You do not have access to this action.' THEN RAISE; END IF; END;
 BEGIN PERFORM public.mis_command('list_unit',jsonb_build_object('sme_id',store_a,'unit_id',piece));RAISE EXCEPTION 'Expected customer stock access refusal';EXCEPTION WHEN others THEN IF SQLERRM='Expected customer stock access refusal' THEN RAISE;END IF;END;
 BEGIN PERFORM public.mis_command('complete_registration','{"role":"Administrator","full_name":"Bad"}');RAISE EXCEPTION 'Expected admin escalation refusal';EXCEPTION WHEN others THEN IF SQLERRM='Expected admin escalation refusal' THEN RAISE;END IF;END;
 PERFORM set_config('request.jwt.claim.sub',owner_a::text,true);
 BEGIN
  PERFORM public.mis_command('report_response',jsonb_build_object('customer_report_id',report,'owner_response','Premature response'));
  RAISE EXCEPTION 'Expected Owner response request prerequisite';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'The Administrator has not requested a response.' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
 PERFORM public.mis_command('request_report_response',jsonb_build_object('customer_report_id',report));
 ASSERT (SELECT status='Under Review' AND owner_response_requested_by=admin_id AND owner_response_requested_at IS NOT NULL FROM public.customer_report WHERE customer_report_id=report),'Request records Administrator and time';
 PERFORM set_config('request.jwt.claim.sub',owner_b::text,true);
 BEGIN
  PERFORM public.mis_command('report_response',jsonb_build_object('customer_report_id',report,'owner_response','Wrong store'));
  RAISE EXCEPTION 'Expected response refusal for another store';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Choose a report for your own store.' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claim.sub',owner_a::text,true);PERFORM public.mis_command('report_response',jsonb_build_object('customer_report_id',report,'owner_response','We are checking the receipt.'));
 PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);PERFORM public.mis_command('review_report',jsonb_build_object('customer_report_id',report,'status','Closed','outcome','Confirmed Discrepancy','outcome_details','The receipt and promotion period confirm the difference.'));
 ASSERT (SELECT status='Closed' AND owner_response IS NOT NULL AND outcome='Confirmed Discrepancy' AND no_response_reason IS NULL FROM public.customer_report WHERE customer_report_id=report),'Report response and outcome retained';
 BEGIN
  PERFORM public.mis_command('review_report',jsonb_build_object('customer_report_id',no_reply_report,'status','Closed','outcome','Insufficient Evidence','outcome_details','The available evidence is insufficient.','no_response_reason','No response received.'));
  RAISE EXCEPTION 'Expected request before closing without a response';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Request an Owner response before closing this report.' THEN RAISE; END IF; END;
 PERFORM public.mis_command('request_report_response',jsonb_build_object('customer_report_id',no_reply_report));
 BEGIN
  PERFORM public.mis_command('review_report',jsonb_build_object('customer_report_id',no_reply_report,'status','Closed','outcome','Insufficient Evidence','outcome_details','The available evidence is insufficient.'));
  RAISE EXCEPTION 'Expected reason for closing without a response';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Enter a valid reason for closing without an Owner response (up to 4000 characters).' THEN RAISE; END IF; END;
 PERFORM public.mis_command('review_report',jsonb_build_object('customer_report_id',no_reply_report,'status','Closed','outcome','Insufficient Evidence','outcome_details','The available evidence is insufficient.','no_response_reason','No response received after follow-up.'));
 ASSERT (SELECT status='Closed' AND owner_response IS NULL AND owner_response_requested_at IS NOT NULL AND no_response_reason='No response received after follow-up.' FROM public.customer_report WHERE customer_report_id=no_reply_report),'Closure without response retains request and justification';
 -- An active discount and another store's pending proposal are not approved regular prices.
 PERFORM set_config('request.jwt.claim.sub',owner_b::text,true);
 req:=(public.mis_command('submit_price',jsonb_build_object('store_price_id',pb,'proposed_price','40'))->>'id')::bigint;
 ASSERT (SELECT status='Pending Price Review' FROM public.price_request WHERE price_request_id=req),'Other store has a pending increase';
 PERFORM set_config('request.jwt.claim.sub',owner_c::text,true);
 req:=(public.mis_command('submit_price',jsonb_build_object('store_price_id',pc,'proposed_price','21.50'))->>'id')::bigint;
 ASSERT (SELECT previous_price=23 AND status='Approved' FROM public.price_request WHERE price_request_id=req),'A changed price captures the previous approved price';
 ASSERT (SELECT snapshot->'references' @> '[{"approved_price":20},{"approved_price":22}]'::jsonb
  AND (snapshot->>'median_price')::numeric=21 FROM public.price_request_evidence WHERE price_request_id=req
 ),'Evidence uses regular approved prices even when discounts and increases are pending';

 -- Separately owned products can contribute exact reference evidence.
 PERFORM set_config('request.jwt.claim.sub',owner_b::text,true);
 tea_b:=(public.create_store_product(jsonb_build_object(
  'sme_id',store_b,'product_name','Evidence Citrus Tea','brand','Reference Farms',
  'category_name','Beverages','stock_unit','bottle','package_size_value','1000',
  'package_size_unit','mL','barcode','00012345678905'
 ))->>'id')::bigint;
 req:=(public.mis_command('submit_price',jsonb_build_object('store_price_id',tea_b,'proposed_price','98'))->>'id')::bigint;
 PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
 PERFORM public.mis_command('review_price',jsonb_build_object('price_request_id',req,'decision','Approved','decision_reason','Initial price reviewed.'));
 -- Older approvals stay visible as evidence even outside the configured automatic decision age.
 UPDATE public.price_history SET effective_at=now()-interval '90 days' WHERE price_request_id=req;
 UPDATE public.store_price SET price_updated_at=now()-interval '90 days' WHERE store_price_id=tea_b;

 PERFORM set_config('request.jwt.claim.sub',owner_c::text,true);
 tea_c:=(public.create_store_product(jsonb_build_object(
  'sme_id',store_c,'product_name',' evidence   citrus TEA ','brand','reference farms',
  'category_name','Drinks','stock_unit','bottle','package_size_value','1','package_size_unit','L'
 ))->>'id')::bigint;
 req:=(public.mis_command('submit_price',jsonb_build_object('store_price_id',tea_c,'proposed_price','100'))->>'id')::bigint;
 ASSERT (SELECT snapshot->>'reference_count'='1' AND snapshot->>'indication'='Insufficient reference data'
  AND snapshot->>'median_price' IS NULL FROM public.price_request_evidence WHERE price_request_id=req),
  'One exact expired-for-policy reference remains evidence without a summary';
 PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
 PERFORM public.mis_command('review_price',jsonb_build_object('price_request_id',req,'decision','Approved','decision_reason','Initial price reviewed.'));

 PERFORM set_config('request.jwt.claim.sub',owner_c::text,true);
 tea_conflict:=(public.create_store_product(jsonb_build_object(
  'sme_id',store_c,'product_name','Evidence Citrus Tea','brand','Reference Farms',
  'category_name','Drinks','stock_unit','bottle','package_size_value','2','package_size_unit','L',
  'barcode','012345678905'
 ))->>'id')::bigint;
 req:=(public.mis_command('submit_price',jsonb_build_object('store_price_id',tea_conflict,'proposed_price','999'))->>'id')::bigint;
 ASSERT (SELECT snapshot->>'reference_count'='0' AND snapshot->>'indication'='No confirmed product match'
  FROM public.price_request_evidence WHERE price_request_id=req),
  'Same barcode with conflicting package size is not a confirmed match';
 PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
 PERFORM public.mis_command('review_price',jsonb_build_object('price_request_id',req,'decision','Approved','decision_reason','Initial price reviewed.'));

 PERFORM set_config('request.jwt.claim.sub',owner_a::text,true);
 tea_a:=(public.create_store_product(jsonb_build_object(
  'sme_id',store_a,'product_name','Evidence Citrus Tea','brand','Reference Farms',
  'category_name','Pantry','stock_unit','bottle','package_size_value','1','package_size_unit','L',
  'barcode','012345678905'
 ))->>'id')::bigint;
 PERFORM public.create_store_product(jsonb_build_object(
  'sme_id',store_a,'product_name','Evidence Citrus Tea','brand','Reference Farms',
  'category_name','Pantry','stock_unit','bottle','package_size_value','1000','package_size_unit','mL',
  'pack_count','6'
 ));
 ASSERT (SELECT count(*)=2 FROM public.store_price
  WHERE store_product_id=(SELECT store_product_id FROM public.store_price WHERE store_price_id=tea_a)),
  'A new pack size shares the existing product stock balance';
 BEGIN
  PERFORM public.create_store_product(jsonb_build_object(
   'sme_id',store_a,'product_name','Evidence Citrus Tea','brand','Reference Farms',
   'category_name','Pantry','stock_unit','bottle','package_size_value','1','package_size_unit','L',
   'pack_count','6'
  ));
  RAISE EXCEPTION 'Expected duplicate pack refusal';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'This pack size already exists.%' THEN RAISE; END IF;
 END;
 tea_request:=(public.mis_command('submit_price',jsonb_build_object('store_price_id',tea_a,'proposed_price','105'))->>'id')::bigint;
 ASSERT (SELECT status='Pending Price Review' AND review_reason='Initial Price Review'
  FROM public.price_request WHERE price_request_id=tea_request
 ),'Owner-created first price stays pending with exact evidence';
 ASSERT (SELECT snapshot->>'participating_store_count'='3' AND snapshot->>'reference_count'='2'
  AND (snapshot->>'minimum_price')::numeric=98 AND (snapshot->>'median_price')::numeric=99
  AND (snapshot->>'maximum_price')::numeric=100 AND (snapshot->>'difference_from_median')::numeric=6
  AND (snapshot->>'percent_difference_from_median')::numeric=6.06
  AND snapshot->>'indication'='Above observed reference range'
  AND snapshot->'references' @> '[{"matching_basis":"Exact barcode"}]'::jsonb
  AND snapshot->'references' @> '[{"matching_basis":"Exact normalized identity"}]'::jsonb
  FROM public.price_request_evidence WHERE price_request_id=tea_request
 ),'Two external SME-owned approved prices produce an exact snapshot and exclude conflicting pack size';

 PERFORM set_config('request.jwt.claim.sub',owner_b::text,true);
 req:=(public.mis_command('submit_price',jsonb_build_object('store_price_id',tea_b,'proposed_price','97'))->>'id')::bigint;
 PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
 PERFORM public.mis_command('review_price',jsonb_build_object('price_request_id',req,'decision','Approved','decision_reason','Updated price reviewed.'));
 ASSERT (SELECT snapshot->'references' @> '[{"approved_price":98}]'::jsonb
  AND NOT snapshot->'references' @> '[{"approved_price":97}]'::jsonb
  FROM public.price_request_evidence WHERE price_request_id=tea_request
 ),'Changing a reference price leaves the earlier submission snapshot intact';
 -- Store the fixture IDs for actual RLS checks below.
 PERFORM set_config('mis.test.admin',admin_id::text,true);
 PERFORM set_config('mis.test.owner',owner_a::text,true);PERFORM set_config('mis.test.customer',customer_id::text,true);PERFORM set_config('mis.test.store',store_a::text,true);
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('mis.test.admin'),true);
DO $$ BEGIN
 ASSERT EXISTS(SELECT 1 FROM public.price_rule WHERE status='Active'),'Administrator sees active price rule';
 ASSERT EXISTS(SELECT 1 FROM public.price_request_evidence WHERE snapshot->>'participating_store_count'='3'),'Administrator can inspect the exact-reference snapshots';
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('mis.test.owner'),true);
DO $$ BEGIN
 ASSERT (SELECT count(*)=1 FROM public.sme),'Owner sees own store only';
 ASSERT jsonb_array_length(public.browse_products('Test sardines')) > 0,'Owner can receive their own published listings';
 ASSERT NOT EXISTS (
  SELECT 1 FROM jsonb_array_elements(public.browse_products('Test sardines')) AS listing
  WHERE listing->>'store_name' <> (SELECT store_name FROM public.sme)
 ),'Signed-in Owner cannot browse listings from other stores';
 ASSERT NOT EXISTS(SELECT 1 FROM public.price_rule),'Owner cannot read price rules';
 ASSERT NOT EXISTS(SELECT 1 FROM public.price_request_evidence),'Owner cannot read reference snapshots';
 ASSERT NOT EXISTS(SELECT 1 FROM public.price_request WHERE reference_count<>0 OR reference_median IS NOT NULL OR allowed_price IS NOT NULL),'Owner-readable requests contain no private comparison metrics';
 ASSERT EXISTS(SELECT 1 FROM public.product WHERE product_name='Test sardines'),'Owner can read the shared catalog';
 ASSERT NOT EXISTS(SELECT 1 FROM public.store_product WHERE sme_id<>current_setting('mis.test.store')::bigint),'Owner stock isolated';
 BEGIN UPDATE public.store_price SET regular_price=1;RAISE EXCEPTION 'Expected direct price-write refusal';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('mis.test.customer'),true);
DO $$ BEGIN
 ASSERT NOT EXISTS(SELECT 1 FROM public.store_product),'Customer cannot read private stock';
 ASSERT NOT EXISTS(SELECT 1 FROM public.price_request),'Customer cannot read internal approvals';
 ASSERT NOT EXISTS(SELECT 1 FROM public.price_rule),'Customer cannot read price rules';
 ASSERT NOT EXISTS(SELECT 1 FROM public.price_request_evidence),'Customer cannot read reference snapshots';
 ASSERT NOT EXISTS(SELECT 1 FROM public.product) AND NOT EXISTS(SELECT 1 FROM public.promotion),'Customer cannot read raw catalog or promotions';
 ASSERT jsonb_array_length(public.browse_products('Test sardines'))=4,'Customer can browse public catalog';
 ASSERT (SELECT count(*)=2 FROM public.customer_report),'Customer sees own reports';
END $$;
RESET ROLE;
UPDATE public.user_account SET role='Owner' WHERE user_id=current_setting('mis.test.customer')::uuid;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ASSERT (SELECT count(*)=2 FROM public.customer_report),'Owner retains access to their earlier Customer reports';
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true);
DO $$ BEGIN
 ASSERT jsonb_array_length(public.browse_products('Test sardines'))=4,'Guests can browse';
 BEGIN PERFORM public.mis_command('stock','{}');RAISE EXCEPTION 'Expected guest command refusal';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM * FROM public.store_product;RAISE EXCEPTION 'Expected guest private-read refusal';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'All integration scenarios and role isolation checks passed; fixtures rolled back.' AS result;
