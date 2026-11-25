alter table public.account_roles add column suspended_at timestamptz;

create function private.has_active_session()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.sessions
    where id = (select nullif(auth.jwt() ->> 'session_id', '')::uuid)
      and user_id = (select auth.uid())
  );
$$;

revoke all on function private.has_active_session() from public, anon, authenticated;
grant execute on function private.has_active_session() to authenticated;

alter policy "Read own account type" on public.account_roles
  using (
    user_id = (select auth.uid())
    and suspended_at is null
    and (select private.has_active_session())
  );

create function private.set_managed_account_suspension(target_user_id uuid, suspend boolean)
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

  -- Supabase Auth checks this value during sign-in. Use a finite timestamp
  -- so Auth can serialize it and clear it when an Administrator unsuspends.
  update auth.users
  set banned_until = case when suspend then now() + interval '100 years' else null end
  where id = target_user_id;

  -- Refresh tokens refer to sessions with ON DELETE CASCADE.
  delete from auth.sessions where user_id = target_user_id;
end;
$$;

create function public.set_managed_account_suspension(target_user_id uuid, suspend boolean)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.set_managed_account_suspension(target_user_id, suspend);
$$;

revoke all on function private.set_managed_account_suspension(uuid, boolean) from public, anon, authenticated;
revoke all on function public.set_managed_account_suspension(uuid, boolean) from public, anon, authenticated;
grant execute on function private.set_managed_account_suspension(uuid, boolean) to authenticated;
grant execute on function public.set_managed_account_suspension(uuid, boolean) to authenticated;

create or replace function private.list_managed_accounts(
  search_email text,
  filter_role text,
  page_offset integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.has_active_session()) or not exists (
    select 1 from public.account_roles
    where user_id = (select auth.uid()) and account_type = 'admin' and suspended_at is null
  ) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  return (
    with matches as (
      select users.id, users.email, roles.account_type, users.created_at,
             (users.email_confirmed_at is not null) as email_confirmed,
             users.last_sign_in_at, roles.suspended_at
      from public.account_roles as roles
      join auth.users as users on users.id = roles.user_id
      where roles.account_type in ('owner', 'customer')
        and (filter_role is null or roles.account_type = filter_role)
        and (
          coalesce(search_email, '') = ''
          or strpos(lower(users.email), lower(left(search_email, 254))) > 0
        )
    ),
    page as (
      select * from matches
      order by created_at desc, id desc
      limit 25 offset greatest(coalesce(page_offset, 0), 0)
    )
    select jsonb_build_object(
      'total', (select count(*) from matches),
      'accounts', coalesce(
        (select jsonb_agg(page order by created_at desc, id desc) from page),
        '[]'::jsonb
      )
    )
  );
end;
$$;
