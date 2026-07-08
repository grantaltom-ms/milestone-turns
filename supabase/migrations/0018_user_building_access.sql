-- Per-user building (property) visibility.
-- An admin can restrict which buildings a given user sees. Semantics:
--   * A user with NO rows here sees ALL buildings (restriction is opt-in).
--   * A user with rows here sees ONLY those buildings.
--   * Admins always see everything (enforced in app code, not here).
create table if not exists public.user_building_access (
  profile_id  uuid   not null references public.profiles(id)   on delete cascade,
  property_id bigint not null references public.properties(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (profile_id, property_id)
);

create index if not exists user_building_access_profile_idx
  on public.user_building_access (profile_id);

alter table public.user_building_access enable row level security;

-- Read: any authenticated session (the app reads the current user's own scope).
drop policy if exists user_building_access_read on public.user_building_access;
create policy user_building_access_read on public.user_building_access
  for select to authenticated using (true);

-- Write: admins only (matches the admin RLS pattern in 0011).
drop policy if exists user_building_access_admin_write on public.user_building_access;
create policy user_building_access_admin_write on public.user_building_access
  for all to authenticated
  using      (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
