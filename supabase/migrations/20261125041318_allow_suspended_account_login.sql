alter policy "Read own account type" on public.account_roles
  using (user_id = (select auth.uid()) and (select private.has_active_session()));

-- Clear only bans set by the prior app suspension procedure.
update auth.users as users
set banned_until = null
from public.account_roles as roles
where users.id = roles.user_id
  and users.banned_until = roles.suspended_at + interval '100 years';

create or replace function private.set_managed_account_suspension(target_user_id uuid, suspend boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_suspension timestamptz;
begin
  if not (select private.has_active_session()) or not exists (
    select 1 from public.account_roles
    where user_id = (select auth.uid()) and account_type = 'admin'
      and suspended_at is null
  ) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  if suspend is null then
    raise exception 'Choose a suspension action.' using errcode = '22023';
  end if;

  select suspended_at into current_suspension
  from public.account_roles
  where user_id = target_user_id and account_type in ('owner', 'customer')
  for update;

  if not found then
    raise exception 'Account is unavailable.' using errcode = 'P0002';
  end if;

  if suspend = (current_suspension is not null) then
    return;
  end if;

  update public.account_roles
  set suspended_at = case when suspend then now() else null end
  where user_id = target_user_id;

end;
$$;
