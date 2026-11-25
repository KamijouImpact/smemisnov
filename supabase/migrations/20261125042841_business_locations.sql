create table public.psgc_locations (
  code text primary key check (code ~ '^[0-9]{10}$'),
  label text not null,
  kind text not null check (kind in ('R','P','L','D','B')),
  parent_code text references public.psgc_locations(code),
  check ((kind = 'R') = (parent_code is null))
);

create index psgc_locations_parent_idx on public.psgc_locations (parent_code, label, code);
alter table public.psgc_locations enable row level security;
revoke all on public.psgc_locations from public, anon, authenticated;
grant select on public.psgc_locations to authenticated;
create policy "Read official location reference data" on public.psgc_locations
for select to authenticated using (true);

alter table public.businesses
  add column barangay_code text references public.psgc_locations(code),
  add column location_detail text check (char_length(location_detail) <= 100),
  add column google_place_id text check (char_length(google_place_id) <= 512),
  drop constraint businesses_address_check,
  add constraint businesses_address_check check (char_length(address) between 5 and 480);

create function public.psgc_location_path(location_code text)
returns table(code text, label text, kind text)
language sql stable security invoker set search_path = ''
as $$
  with recursive path as (
    select p.*, 0 as depth from public.psgc_locations p where p.code = location_code
    union all
    select p.*, path.depth + 1 from path
      join public.psgc_locations p on p.code = path.parent_code
  )
  select path.code, path.label, path.kind from path order by depth desc;
$$;

revoke all on function public.psgc_location_path(text) from public, anon, authenticated;
grant execute on function public.psgc_location_path(text) to authenticated;

create function private.save_business_profile(name_input text, type_input text, barangay_input text, detail_input text, place_input text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  clean_name text := btrim(regexp_replace(name_input, '[[:space:]]+', ' ', 'g'));
  clean_detail text := nullif(btrim(regexp_replace(detail_input, '[[:space:]]+', ' ', 'g')), '');
  clean_place text := nullif(btrim(place_input), '');
  clean_address text;
begin
  if not (select private.has_active_session()) or not exists (
    select 1 from public.account_roles where user_id = caller_id
      and account_type = 'owner' and suspended_at is null
    for share
  ) then
    raise exception 'Store Owner access is required.' using errcode = '42501';
  end if;

  if clean_name is null or char_length(clean_name) not between 2 and 100
    or char_length(clean_detail) > 100 or char_length(clean_place) > 512
    or not exists (select 1 from public.business_types where label = type_input) then
    raise exception 'Check the business name, business type and location details.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.psgc_locations where code = barangay_input and kind = 'B') then
    raise exception 'Choose a barangay from the official location list.' using errcode = '22023';
  end if;

  select concat_ws(', ', clean_detail, string_agg(path.label, ', ' order by path.ordinality desc))
  into clean_address
  from public.psgc_location_path(barangay_input) with ordinality as path;

  insert into public.businesses as current_business
    (owner_id, business_name, business_type, address, barangay_code, location_detail, google_place_id)
  values (caller_id, clean_name, type_input, clean_address, barangay_input, clean_detail, clean_place)
  on conflict (owner_id) do update
  set business_name = excluded.business_name,
      business_type = excluded.business_type,
      address = excluded.address,
      barangay_code = excluded.barangay_code,
      location_detail = excluded.location_detail,
      google_place_id = excluded.google_place_id,
      status = case when current_business.status = 'paused' then 'paused' else 'pending' end,
      updated_at = clock_timestamp()
  where (current_business.business_name, current_business.business_type, current_business.address, current_business.barangay_code, current_business.google_place_id)
    is distinct from (excluded.business_name, excluded.business_type, excluded.address, excluded.barangay_code, excluded.google_place_id);
end;
$$;

create function public.save_business_profile(name_input text, type_input text, barangay_input text, detail_input text, place_input text)
returns void language sql security invoker set search_path = ''
as $$ select private.save_business_profile(name_input, type_input, barangay_input, detail_input, place_input); $$;

revoke all on function private.save_business_profile(text,text,text,text,text),
  public.save_business_profile(text,text,text,text,text) from public, anon, authenticated;
grant execute on function private.save_business_profile(text,text,text,text,text),
  public.save_business_profile(text,text,text,text,text) to authenticated;
revoke execute on function private.save_business_profile(text,text,text),
  public.save_business_profile(text,text,text) from authenticated;
