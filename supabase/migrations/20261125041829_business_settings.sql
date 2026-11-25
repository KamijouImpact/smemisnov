create table public.business_types (
  label text primary key
);

insert into public.business_types (label) values
  ('Sari-sari store'), ('Grocery'), ('Convenience store'), ('Mini-mart'),
  ('Bakery'), ('School and office supplies'), ('Hardware store'),
  ('Clothing store'), ('Electronics store'), ('Home goods store'),
  ('Pet supplies'), ('Beauty and personal care'), ('General merchandise'),
  ('Health and wellness store');

create table public.businesses (
  owner_id uuid primary key references public.account_roles(user_id) on delete cascade,
  business_name text not null check (char_length(business_name) between 2 and 100),
  business_type text not null references public.business_types(label),
  address text not null check (char_length(address) between 5 and 240),
  status text not null default 'pending' check (status in ('pending', 'active', 'paused')),
  updated_at timestamptz not null default clock_timestamp()
);

alter table public.business_types enable row level security;
alter table public.businesses enable row level security;
revoke all on public.business_types, public.businesses from public, anon, authenticated;
grant select on public.business_types, public.businesses to authenticated;

create policy "Owners and administrators read business types"
on public.business_types for select to authenticated
using (exists (
  select 1 from public.account_roles
  where user_id = (select auth.uid()) and suspended_at is null
    and account_type in ('owner','admin')
));

create policy "Owners read their business and administrators review businesses"
on public.businesses for select to authenticated
using (exists (
  select 1 from public.account_roles as roles
  where roles.user_id = (select auth.uid()) and roles.suspended_at is null
    and (roles.account_type = 'admin' or (roles.account_type = 'owner' and owner_id = roles.user_id))
));

create function private.save_business_profile(name_input text, type_input text, address_input text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  clean_name text := btrim(regexp_replace(name_input, '[[:space:]]+', ' ', 'g'));
  clean_address text := btrim(regexp_replace(address_input, '[[:space:]]+', ' ', 'g'));
begin
  if not (select private.has_active_session()) or not exists (
    select 1 from public.account_roles where user_id = caller_id
      and account_type = 'owner' and suspended_at is null
    for share
  ) then
    raise exception 'Store Owner access is required.' using errcode = '42501';
  end if;

  if clean_name is null or char_length(clean_name) not between 2 and 100
    or clean_address is null or char_length(clean_address) not between 5 and 240
    or not exists (select 1 from public.business_types where label = type_input) then
    raise exception 'Enter a valid business name, business type and address.' using errcode = '22023';
  end if;

  insert into public.businesses as current_business (owner_id, business_name, business_type, address)
  values (caller_id, clean_name, type_input, clean_address)
  on conflict (owner_id) do update
  set business_name = excluded.business_name,
      business_type = excluded.business_type,
      address = excluded.address,
      status = case when current_business.status = 'paused' then 'paused' else 'pending' end,
      updated_at = clock_timestamp()
  where (current_business.business_name, current_business.business_type, current_business.address)
    is distinct from (excluded.business_name, excluded.business_type, excluded.address);
end;
$$;

create function private.review_business(business_owner uuid, expected_updated_at timestamptz, next_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.has_active_session()) or not exists (
    select 1 from public.account_roles where user_id = auth.uid()
      and account_type = 'admin' and suspended_at is null
  ) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  if next_status is null or next_status not in ('active','paused') then
    raise exception 'Choose a valid business status.' using errcode = '22023';
  end if;

  update public.businesses set status = next_status, updated_at = clock_timestamp()
  where owner_id = business_owner and updated_at = expected_updated_at
    and ((status = 'pending' and next_status = 'active')
      or (status = 'paused' and next_status = 'active')
      or (status = 'active' and next_status = 'paused'));

  if not found then
    raise exception 'This business changed. Refresh the page before reviewing it.' using errcode = 'P0002';
  end if;
end;
$$;

create function public.save_business_profile(name_input text, type_input text, address_input text)
returns void language sql security invoker set search_path = ''
as $$ select private.save_business_profile(name_input, type_input, address_input); $$;

create function public.review_business(business_owner uuid, expected_updated_at timestamptz, next_status text)
returns void language sql security invoker set search_path = ''
as $$ select private.review_business(business_owner, expected_updated_at, next_status); $$;

revoke all on function private.save_business_profile(text,text,text), public.save_business_profile(text,text,text),
  private.review_business(uuid,timestamptz,text), public.review_business(uuid,timestamptz,text)
  from public, anon, authenticated;
grant execute on function private.save_business_profile(text,text,text), public.save_business_profile(text,text,text),
  private.review_business(uuid,timestamptz,text), public.review_business(uuid,timestamptz,text)
  to authenticated;
