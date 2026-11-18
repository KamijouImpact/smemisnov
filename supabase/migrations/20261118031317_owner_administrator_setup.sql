-- Deployment setup: grant Administrator only to this connected project owner's verified email.
-- This is never read from user-editable metadata or accepted from the registration form.
CREATE FUNCTION private.verified_project_owner() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF lower(new.email)='kenthilo0000@gmail.com' AND new.email_confirmed_at IS NOT NULL THEN
 UPDATE public.user_account SET role='Administrator' WHERE user_id=new.id;
 END IF;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION private.verified_project_owner() FROM public,anon,authenticated;
CREATE TRIGGER owner_administrator_setup AFTER INSERT OR UPDATE OF email,email_confirmed_at ON auth.users FOR EACH ROW EXECUTE FUNCTION private.verified_project_owner();
UPDATE public.user_account a SET role='Administrator' FROM auth.users u WHERE u.id=a.user_id AND lower(u.email)='kenthilo0000@gmail.com' AND u.email_confirmed_at IS NOT NULL;
