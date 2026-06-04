-- Property names aren't sensitive — let the anon role read them so the
-- Board can resolve turns.property_id → properties.name without auth.
-- (Aliases are already readable to anon, which is why imports work.)

drop policy if exists "anon can read property names" on public.properties;

create policy "anon can read property names" on public.properties
  for select to anon using (true);
