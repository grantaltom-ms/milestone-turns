-- The `properties` table predates this migration history (created before
-- migrations were adopted) and its base grants/RLS policies were reset by
-- something outside this history, taking production down: RLS is enabled
-- with zero policies, so nobody but the DB owner could read it. This
-- restores exactly what 0004_allow_anon_read_properties.sql already
-- documents as intended (anon read-only) plus the equivalent grant/policy
-- for authenticated, which every other table in this app already has.
grant select on public.properties to anon, authenticated;

drop policy if exists "anon can read property names" on public.properties;
create policy "anon can read property names" on public.properties
  for select to anon using (true);

drop policy if exists "authenticated can read properties" on public.properties;
create policy "authenticated can read properties" on public.properties
  for select to authenticated using (true);
