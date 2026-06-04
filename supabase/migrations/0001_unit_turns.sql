-- Unit Turn Tracker schema
-- Run against the main property project: augbrysfqwgekfhfokco

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- app_users: maps Supabase auth.users → team initials + display name
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.app_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  initials   text not null,
  name       text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists app_users_initials_idx on public.app_users (initials);

-- ─────────────────────────────────────────────────────────────────────────────
-- turns: one row per vacant unit being turned
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.turns (
  id           uuid primary key default gen_random_uuid(),
  property_id  bigint not null references public.properties(id) on delete restrict,
  unit         text   not null,           -- free-text unit label (e.g. "#204")
  stage_idx    smallint not null default 0 check (stage_idx between 0 and 6),
  vacate_date  date not null,
  target_date  date not null,
  assignee     text not null,             -- team initials
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists turns_stage_idx on public.turns (stage_idx);
create index if not exists turns_assignee_idx on public.turns (assignee);

-- ─────────────────────────────────────────────────────────────────────────────
-- turn_tasks: checklist items for the current stage of a turn
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.turn_tasks (
  id         uuid primary key default gen_random_uuid(),
  turn_id    uuid not null references public.turns(id) on delete cascade,
  name       text not null,
  assignee   text not null,
  done       boolean not null default false,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists turn_tasks_turn_idx on public.turn_tasks (turn_id, sort_order);

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at triggers
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists turns_touch on public.turns;
create trigger turns_touch
  before update on public.turns
  for each row execute function public.touch_updated_at();

drop trigger if exists turn_tasks_touch on public.turn_tasks;
create trigger turn_tasks_touch
  before update on public.turn_tasks
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Default task templates per stage (matches design spec)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.default_tasks_for_stage(stage integer)
returns text[] language sql immutable as $$
  select case stage
    when 0 then array['Confirm vacate date','Send move-out instructions','Schedule pre-vacate walk']
    when 1 then array['Confirm keys returned','Document unit condition','Note all damage items']
    when 2 then array['Walk unit with inspector','Document all repairs needed','Get vendor quotes','Finalize scope list','Order materials','Set repair start date']
    when 3 then array['Patch & paint walls','Replace bedroom blinds','Fix garbage disposal','Replace bathroom fan']
    when 4 then array['Deep clean kitchen','Clean bathrooms','Vacuum & mop floors','Clean windows','Remove all debris']
    when 5 then array['Walk with supervisor','Verify all repairs complete','Verify cleaning complete','Sign off on unit']
    when 6 then array['Take marketing photos','Update listing','Confirm availability date']
    else array[]::text[]
  end;
$$;

-- Atomic: bump stage_idx + replace checklist with next stage's defaults
create or replace function public.advance_turn(p_turn_id uuid)
returns public.turns
language plpgsql as $$
declare
  t public.turns;
  next_stage smallint;
  task_names text[];
begin
  select * into t from public.turns where id = p_turn_id for update;
  if not found then raise exception 'turn % not found', p_turn_id; end if;
  if t.stage_idx >= 6 then raise exception 'turn already at terminal stage'; end if;

  -- Reject advance if any task is still open
  if exists (select 1 from public.turn_tasks where turn_id = p_turn_id and done = false) then
    raise exception 'cannot advance: tasks still incomplete';
  end if;

  next_stage := t.stage_idx + 1;
  task_names := public.default_tasks_for_stage(next_stage);

  delete from public.turn_tasks where turn_id = p_turn_id;
  insert into public.turn_tasks (turn_id, name, assignee, done, sort_order)
  select p_turn_id, unnest(task_names), t.assignee, false,
         generate_series(0, array_length(task_names, 1) - 1);

  update public.turns set stage_idx = next_stage where id = p_turn_id
    returning * into t;
  return t;
end;
$$;

-- Atomic: create a new turn + seed its Notice checklist
create or replace function public.create_turn(
  p_property_id bigint,
  p_unit text,
  p_vacate_date date,
  p_target_date date,
  p_assignee text
) returns public.turns
language plpgsql as $$
declare
  t public.turns;
  task_names text[];
begin
  insert into public.turns (property_id, unit, stage_idx, vacate_date, target_date, assignee)
  values (p_property_id, p_unit, 0, p_vacate_date, p_target_date, p_assignee)
  returning * into t;

  task_names := public.default_tasks_for_stage(0);
  insert into public.turn_tasks (turn_id, name, assignee, done, sort_order)
  select t.id, unnest(task_names), p_assignee, false,
         generate_series(0, array_length(task_names, 1) - 1);

  return t;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — any authenticated staff member can read & write turns/tasks
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.app_users   enable row level security;
alter table public.turns       enable row level security;
alter table public.turn_tasks  enable row level security;

drop policy if exists "app_users read" on public.app_users;
create policy "app_users read" on public.app_users
  for select to authenticated using (true);

drop policy if exists "app_users self upsert" on public.app_users;
create policy "app_users self upsert" on public.app_users
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "turns read" on public.turns;
create policy "turns read" on public.turns
  for select to authenticated using (true);

drop policy if exists "turns write" on public.turns;
create policy "turns write" on public.turns
  for all to authenticated using (true) with check (true);

drop policy if exists "turn_tasks read" on public.turn_tasks;
create policy "turn_tasks read" on public.turn_tasks
  for select to authenticated using (true);

drop policy if exists "turn_tasks write" on public.turn_tasks;
create policy "turn_tasks write" on public.turn_tasks
  for all to authenticated using (true) with check (true);

-- Allow the RPCs to be called by authenticated users
grant execute on function public.create_turn(bigint, text, date, date, text) to authenticated;
grant execute on function public.advance_turn(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime publication
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'turns'
  ) then
    execute 'alter publication supabase_realtime add table public.turns';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'turn_tasks'
  ) then
    execute 'alter publication supabase_realtime add table public.turn_tasks';
  end if;
end $$;
