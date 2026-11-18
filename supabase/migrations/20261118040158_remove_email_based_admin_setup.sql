-- Email confirmation may be disabled. An email address must never grant Administrator access.
DROP TRIGGER IF EXISTS owner_administrator_setup ON auth.users;
DROP FUNCTION IF EXISTS private.verified_project_owner();
-- Existing account roles remain unchanged. New Administrators are assigned by a trusted database operator using their account UUID.
