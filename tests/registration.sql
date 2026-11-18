-- Email-confirmation-off behavior: signup and confirmation metadata cannot grant Admin.
BEGIN;
DO $$
DECLARE account_uuid uuid:=gen_random_uuid();
BEGIN
 ASSERT NOT EXISTS(SELECT 1 FROM information_schema.triggers WHERE trigger_schema='auth' AND trigger_name='owner_administrator_setup'),'Email-based Administrator trigger must be removed';
 INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES(account_uuid,account_uuid::text||'@example.test',now(),'{"requested_role":"Administrator","role":"Administrator","full_name":"Registration test"}');
 ASSERT (SELECT role='Customer' FROM public.user_account WHERE user_id=account_uuid),'An auto-confirmed signup must start as Customer';
 PERFORM set_config('request.jwt.claim.sub',account_uuid::text,true);
 BEGIN
 PERFORM public.mis_command('complete_registration','{"role":"Administrator","full_name":"Registration test"}');
 RAISE EXCEPTION 'Unexpected Administrator self-assignment';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Unexpected Administrator self-assignment' THEN RAISE; END IF; END;
 PERFORM public.mis_command('complete_registration','{"role":"Owner","full_name":"Registration test"}');
 ASSERT (SELECT role='Owner' FROM public.user_account WHERE user_id=account_uuid),'Immediate signup can complete an Owner profile';
 UPDATE auth.users SET email_confirmed_at=now(),raw_user_meta_data='{"requested_role":"Administrator"}' WHERE auth.users.id=account_uuid;
 ASSERT (SELECT role='Owner' FROM public.user_account WHERE user_id=account_uuid),'Confirmation and metadata cannot promote the account';
END $$;
ROLLBACK;
SELECT 'Registration role checks passed; test records rolled back.' AS result;
