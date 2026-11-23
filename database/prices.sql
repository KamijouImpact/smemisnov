CREATE FUNCTION private.normalize_price_identity(value text) RETURNS text
 LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
 SELECT lower(trim(regexp_replace(coalesce(value, ''), '[[:space:]]+', ' ', 'g')))
$$;

CREATE VIEW private.price_listing_identity WITH (security_invoker = true) AS
 SELECT listing.store_price_id, item.store_product_id, item.sme_id, product.product_id,
   product.sme_id AS catalog_owner_sme_id, variant.variation_id, unit.unit_id,
   listing.regular_price, listing.price_updated_at,
   private.normalize_gtin(coalesce(nullif(unit.store_barcode, ''), unit.gtin)) AS barcode,
   normalized.descriptors,
   normalized.descriptors->>'name' <> ''
    AND normalized.descriptors->>'stock_unit' <> ''
    AND (
      variant.net_quantity IS NOT NULL OR unit.stock_units > 1
      OR normalized.descriptors->>'model' <> ''
      OR normalized.descriptors->>'variant' NOT IN ('', 'standard')
      OR normalized.descriptors->>'size' <> ''
      OR normalized.descriptors->>'color' <> ''
      OR normalized.descriptors->>'flavor' <> ''
      OR normalized.descriptors->>'capacity' <> ''
      OR normalized.descriptors->>'details' <> ''
    ) AS descriptive_identity
 FROM public.store_price listing
 JOIN public.store_product item USING (store_product_id)
 JOIN public.product_variation variant USING (variation_id)
 JOIN public.product product USING (product_id)
 LEFT JOIN public.brand brand USING (brand_id)
 JOIN public.product_unit unit ON unit.unit_id = listing.unit_id
  AND unit.variation_id = variant.variation_id
 CROSS JOIN LATERAL (
  SELECT jsonb_build_object(
   'name', private.normalize_price_identity(product.product_name),
   'brand', private.normalize_price_identity(coalesce(product.store_brand_name, brand.brand_name)),
   'model', private.normalize_price_identity(product.model_or_style),
   'variant', private.normalize_price_identity(variant.variation_name),
   'size', private.normalize_price_identity(variant.size),
   'color', private.normalize_price_identity(variant.color),
   'flavor', private.normalize_price_identity(variant.flavor),
   'capacity', private.normalize_price_identity(variant.capacity),
   'net_quantity', variant.net_quantity,
   'net_unit', private.normalize_price_identity(variant.net_unit),
   'condition', private.normalize_price_identity(variant.condition),
   'stock_unit', private.normalize_price_identity(variant.stock_unit),
   'details', private.normalize_price_identity(variant.other_details),
   'pack_count', unit.stock_units
  ) AS descriptors
 ) normalized;
REVOKE ALL ON private.price_listing_identity FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.exact_price_references(
 listing_id bigint, legacy_unit_only boolean DEFAULT false, maximum_age_days integer DEFAULT NULL
) RETURNS jsonb
 LANGUAGE sql STABLE SET search_path = '' AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(reference) ORDER BY reference.sme_id), '[]'::jsonb)
 FROM (
  SELECT DISTINCT ON (candidate.sme_id)
   candidate.sme_id, store.store_name, candidate.product_id, candidate.variation_id,
   candidate.unit_id, candidate.store_price_id, candidate.store_product_id,
   history.price_history_id, history.new_price AS approved_price,
   history.effective_at AS price_updated_at,
   CASE WHEN candidate.barcode = subject.barcode THEN 'Exact barcode'
    ELSE 'Exact normalized identity' END AS matching_basis,
   candidate.descriptors || jsonb_build_object('barcode', candidate.barcode) AS product_identity
  FROM private.price_listing_identity subject
  JOIN private.price_listing_identity candidate
   ON candidate.sme_id <> subject.sme_id
   AND candidate.descriptors = subject.descriptors
   AND (
    candidate.barcode = subject.barcode
    OR (subject.descriptive_identity AND candidate.descriptive_identity
        AND (candidate.barcode IS NULL OR subject.barcode IS NULL))
   )
  JOIN public.sme store ON store.sme_id = candidate.sme_id
  JOIN LATERAL (
   SELECT latest.price_history_id, latest.new_price, latest.effective_at
   FROM public.price_history latest
   WHERE latest.store_price_id = candidate.store_price_id
   ORDER BY latest.price_history_id DESC LIMIT 1
  ) history ON history.new_price = candidate.regular_price
     AND history.effective_at = candidate.price_updated_at
  WHERE subject.store_price_id = listing_id
    AND private.active_option(candidate.store_price_id)
    AND (NOT legacy_unit_only OR candidate.unit_id = subject.unit_id)
    AND (
      maximum_age_days IS NULL
      OR history.effective_at >= now() - make_interval(days => maximum_age_days)
    )
  ORDER BY candidate.sme_id, (candidate.barcode = subject.barcode) DESC NULLS LAST,
   history.effective_at DESC, history.price_history_id DESC
 ) reference
$$;

CREATE FUNCTION private.price_evidence_snapshot(
 matches jsonb, proposed numeric, recorded_at timestamptz, historical boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
 prices numeric[];
 source_count integer;
 minimum numeric;
 median numeric;
 maximum numeric;
 indication text;
BEGIN
 SELECT array_agg(ref.approved_price ORDER BY ref.approved_price)
 INTO prices FROM jsonb_to_recordset(matches) AS ref(approved_price numeric);
 source_count := coalesce(cardinality(prices), 0);

 IF source_count = 0 THEN
  indication := 'No confirmed product match';
 ELSIF source_count < 2 THEN
  indication := 'Insufficient reference data';
 ELSE
  minimum := prices[1];
  median := (prices[(source_count + 1) / 2] + prices[(source_count + 2) / 2]) / 2;
  maximum := prices[source_count];
  indication := CASE
   WHEN proposed < minimum THEN 'Below observed reference range'
   WHEN proposed > maximum THEN 'Above observed reference range'
   WHEN proposed > median THEN 'Above observed median but within observed range'
   ELSE 'Within observed reference range'
  END;
 END IF;

 RETURN jsonb_build_object(
  'recorded_at', recorded_at, 'historical', historical, 'references', matches,
  'participating_store_count', source_count + 1, 'reference_count', source_count,
  'minimum_price', minimum, 'median_price', median, 'maximum_price', maximum,
  'difference_from_median', proposed - median,
  'percent_difference_from_median', round(100 * (proposed - median) / nullif(median, 0), 2),
  'indication', indication
 );
END $$;

REVOKE ALL ON FUNCTION private.normalize_price_identity(text),
 private.exact_price_references(bigint, boolean, integer),
 private.price_evidence_snapshot(jsonb, numeric, timestamptz, boolean)
 FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.submit_price(a jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 uid uuid;
 opt public.store_price;
 rule public.price_rule;
 request_id bigint;
 catalog_owner_sme_id bigint;
 proposal numeric;
 prior bigint;
 count_sources integer := 0;
 required_sources integer;
 median numeric;
 cutoff numeric;
 reason text;
 reliable boolean;
 review_evidence jsonb;
 policy_matches jsonb;
BEGIN
 uid := private.require_role(ARRAY['Owner']);
 PERFORM pg_advisory_xact_lock(731901);
 opt := private.own_option((a->>'store_price_id')::bigint);
 proposal := private.money(a->>'proposed_price');
 IF proposal IS NOT DISTINCT FROM opt.regular_price THEN
  RAISE EXCEPTION 'This is already the approved price.';
 END IF;

 prior := nullif(a->>'previous_request_id','')::bigint;
 IF prior IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public.price_request
  WHERE price_request_id = prior AND store_price_id = opt.store_price_id
   AND status IN ('Rejected', 'Withdrawn')
 ) THEN
  RAISE EXCEPTION 'Choose a rejected or withdrawn request for this same listing.';
 END IF;

 SELECT * INTO rule FROM public.price_rule
 WHERE status = 'Active' AND effective_from <= now();
 SELECT variant.allow_price_reference, product.sme_id INTO STRICT reliable, catalog_owner_sme_id
 FROM public.store_product item
 JOIN public.product_variation variant USING (variation_id)
 JOIN public.product product USING (product_id)
 WHERE item.store_product_id = opt.store_product_id;

 required_sources := CASE WHEN catalog_owner_sme_id IS NOT NULL
  THEN greatest(rule.minimum_stores, 2) ELSE rule.minimum_stores END;

 INSERT INTO public.price_request (
  store_price_id, submitted_by, previous_price, proposed_price, owner_reason,
  submitted_at, checked_at, rule_id, previous_request_id
 )
 VALUES (
  opt.store_price_id, uid, opt.regular_price, proposal, nullif(trim(a->>'owner_reason'), ''),
  now(), now(), rule.rule_id, prior
 )
 RETURNING price_request_id INTO request_id;

 review_evidence := private.price_evidence_snapshot(
  private.exact_price_references(opt.store_price_id), proposal, now()
 );

 -- The existing configured approval policy stays separate from observed
 -- evidence while the approval-policy conflict is resolved.
 IF NOT (catalog_owner_sme_id IS NOT NULL AND opt.regular_price IS NULL)
    AND rule.rule_id IS NOT NULL AND reliable THEN
  policy_matches := private.exact_price_references(
   opt.store_price_id, catalog_owner_sme_id IS NULL, rule.maximum_age_days
  );
  INSERT INTO public.price_reference (price_request_id, reference_sme_id, price_history_id)
  SELECT request_id, ref.sme_id, ref.price_history_id
  FROM jsonb_to_recordset(policy_matches) AS ref(sme_id bigint, price_history_id bigint);
  count_sources := jsonb_array_length(policy_matches);

  IF count_sources >= required_sources THEN
   SELECT avg(sorted.approved_price) INTO median FROM (
    SELECT ref.approved_price, row_number() OVER (ORDER BY ref.approved_price) AS rank
    FROM jsonb_to_recordset(policy_matches) AS ref(approved_price numeric)
   ) sorted WHERE sorted.rank IN ((count_sources + 1) / 2, (count_sources + 2) / 2);
   cutoff := floor(median * (1 + rule.allowance_percent / 100) * 100) / 100;
  END IF;
 END IF;

 reason := CASE
  WHEN catalog_owner_sme_id IS NOT NULL AND opt.regular_price IS NULL THEN 'Initial Price Review'
  WHEN NOT reliable THEN 'Unreliable Product Match'
  WHEN rule.rule_id IS NULL THEN 'No Active Rule'
  WHEN count_sources < required_sources OR cutoff IS NULL THEN 'Too Few References'
  WHEN proposal > cutoff THEN 'Above Reference'
  ELSE NULL
 END;
 UPDATE public.price_request SET review_reason = reason WHERE price_request_id = request_id;

 INSERT INTO public.price_request_evidence (price_request_id, snapshot, policy_snapshot)
 VALUES (
  request_id, review_evidence,
  jsonb_build_object(
   'rule_id', rule.rule_id, 'reference_count', count_sources,
   'median_price', median, 'allowed_price', cutoff
  )
 );

 IF reason IS NULL THEN
  PERFORM private.activate_price(request_id, 'System', NULL, 'Within the current price rule.');
 END IF;
 RETURN jsonb_build_object('id', request_id, 'message', CASE
  WHEN reason IS NULL THEN 'Price approved.'
  ELSE 'Pending Price Review: ' || reason || '. Your current approved price stays in use.'
 END);
END $$;
REVOKE ALL ON FUNCTION private.submit_price(jsonb) FROM PUBLIC, anon, authenticated;

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
