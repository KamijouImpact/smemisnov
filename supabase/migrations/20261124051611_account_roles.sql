create table public.account_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  account_type text not null check (account_type in ('owner', 'customer'))
);

alter table public.account_roles enable row level security;

revoke all on table public.account_roles from public, anon, authenticated;
grant select on table public.account_roles to authenticated;

create policy "Read own account type"
  on public.account_roles
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create schema if not exists private;

create function private.assign_account_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Signup metadata is input only. Later metadata edits do not change the role.
  insert into public.account_roles (user_id, account_type)
  values (
    new.id,
    case when new.raw_user_meta_data ->> 'account_type' = 'owner'
      then 'owner' else 'customer' end
  );
  return new;
end;
$$;

revoke execute on function private.assign_account_type() from public, anon, authenticated;

create trigger assign_account_type
  after insert on auth.users
  for each row execute function private.assign_account_type();

insert into public.account_roles (user_id, account_type)
select id, 'customer' from auth.users
on conflict (user_id) do nothing;
