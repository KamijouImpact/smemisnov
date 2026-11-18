BEGIN;

-- Keep existing stores and reserve one registration per Owner going forward.
LOCK TABLE public.sme IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE private.store_registration (
  owner_id uuid PRIMARY KEY REFERENCES public.user_account(user_id) ON DELETE CASCADE
);
REVOKE ALL ON TABLE private.store_registration FROM public, anon, authenticated;

INSERT INTO private.store_registration (owner_id)
SELECT DISTINCT owner_id FROM public.sme;

CREATE FUNCTION private.reserve_store_registration()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO private.store_registration (owner_id) VALUES (NEW.owner_id)
  ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This Owner already has a registered store.';
  END IF;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION private.reserve_store_registration() FROM public, anon, authenticated;

CREATE TRIGGER reserve_store_registration
BEFORE INSERT ON public.sme
FOR EACH ROW EXECUTE FUNCTION private.reserve_store_registration();

COMMIT;
