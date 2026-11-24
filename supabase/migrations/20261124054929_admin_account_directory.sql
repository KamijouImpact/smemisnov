create function private.list_managed_accounts(
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
  if not exists (
    select 1 from public.account_roles
    where user_id = (select auth.uid()) and account_type = 'admin'
  ) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  return (
    with matches as (
      select users.id, users.email, roles.account_type, users.created_at,
             (users.email_confirmed_at is not null) as email_confirmed,
             users.last_sign_in_at
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

create function public.list_managed_accounts(
  search_email text default null,
  filter_role text default null,
  page_offset integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.list_managed_accounts(search_email, filter_role, page_offset);
$$;

grant usage on schema private to authenticated;
revoke all on function private.list_managed_accounts(text, text, integer) from public, anon, authenticated;
revoke all on function public.list_managed_accounts(text, text, integer) from public, anon, authenticated;
grant execute on function private.list_managed_accounts(text, text, integer) to authenticated;
grant execute on function public.list_managed_accounts(text, text, integer) to authenticated;
