-- Relax RLS so the anon role can read/write turns + tasks while we're still
-- in dev (NEXT_PUBLIC_REQUIRE_AUTH is off). When you turn auth on, run a
-- follow-up migration that drops these and reinstates `to authenticated` only.

drop policy if exists "app_users read"        on public.app_users;
drop policy if exists "app_users self upsert" on public.app_users;
drop policy if exists "turns read"            on public.turns;
drop policy if exists "turns write"           on public.turns;
drop policy if exists "turn_tasks read"       on public.turn_tasks;
drop policy if exists "turn_tasks write"      on public.turn_tasks;

create policy "app_users read"   on public.app_users
  for select to anon, authenticated using (true);

create policy "turns read"       on public.turns
  for select to anon, authenticated using (true);

create policy "turns write"      on public.turns
  for all    to anon, authenticated using (true) with check (true);

create policy "turn_tasks read"  on public.turn_tasks
  for select to anon, authenticated using (true);

create policy "turn_tasks write" on public.turn_tasks
  for all    to anon, authenticated using (true) with check (true);

-- Let anon call the create/advance RPCs too
grant execute on function public.create_turn(bigint, text, date, date, text) to anon;
grant execute on function public.advance_turn(uuid) to anon;
