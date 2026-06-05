-- Phase 1.3 — CORNERSTONE. Stop destroying task history on stage advance.
-- Seed all 6 stages' default tasks at turn creation; advance is now just a
-- pointer bump, never a delete. Per-task completion is now timestamped and
-- attributed.
--
-- Changes:
--   turn_tasks: + stage_idx, done_at, completed_by
--   turns:      + stage_entered_at
--   create_turn():  seeds tasks for stages 0–5 (not just stage 0)
--   advance_turn(): no longer deletes anything
--   backfill:   live turns get their past- and future-stage tasks filled in
--               (past = done with no record, future = unchecked)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add columns
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.turn_tasks
  add column if not exists stage_idx     smallint,
  add column if not exists done_at       timestamptz,
  add column if not exists completed_by  text;

alter table public.turns
  add column if not exists stage_entered_at timestamptz;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Backfill existing rows
-- ─────────────────────────────────────────────────────────────────────────────

-- 2a. Each existing task belongs to its turn's current stage.
update public.turn_tasks tt
set stage_idx = t.stage_idx
from public.turns t
where tt.turn_id = t.id
  and tt.stage_idx is null;

-- 2b. Existing turns get stage_entered_at populated from updated_at as the
-- best approximation we have (no real history exists pre-migration).
update public.turns
set stage_entered_at = coalesce(updated_at, created_at, now())
where stage_entered_at is null;

-- 2c. Mark any pre-existing checked tasks with the turn owner as completed_by
-- and now() as done_at (we have no real audit trail to draw from).
update public.turn_tasks tt
set done_at      = coalesce(tt.updated_at, now()),
    completed_by = t.assignee
from public.turns t
where tt.turn_id = t.id
  and tt.done = true
  and tt.done_at is null;

-- 2d. Seed missing tasks for ALL other stages of each existing turn:
--   • Past stages (stage_idx < turn.stage_idx) → done=true, no done_at/by record
--   • Future stages (stage_idx > turn.stage_idx) → done=false, normal
insert into public.turn_tasks (turn_id, name, assignee, done, sort_order, stage_idx)
select
  t.id,
  task.name,
  t.assignee,
  (s.idx < t.stage_idx),       -- past stages backfill as done
  task.ordinality - 1,
  s.idx
from public.turns t
cross join generate_series(0, 5) as s(idx)
cross join lateral unnest(public.default_tasks_for_stage(s.idx::integer))
  with ordinality as task(name, ordinality)
where s.idx <> t.stage_idx
  and not exists (
    select 1 from public.turn_tasks tt
    where tt.turn_id = t.id and tt.stage_idx = s.idx
  );

-- Now that everything is backfilled, lock stage_idx as NOT NULL.
alter table public.turn_tasks alter column stage_idx set not null;
alter table public.turn_tasks
  drop constraint if exists turn_tasks_stage_idx_check;
alter table public.turn_tasks
  add constraint turn_tasks_stage_idx_check check (stage_idx between 0 and 5);

alter table public.turns alter column stage_entered_at set not null;
alter table public.turns alter column stage_entered_at set default now();

create index if not exists turn_tasks_turn_stage_idx
  on public.turn_tasks (turn_id, stage_idx, sort_order);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Rewrite create_turn: seed all 6 stages at once
-- ─────────────────────────────────────────────────────────────────────────────
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
begin
  insert into public.turns (property_id, unit, stage_idx, vacate_date, target_date, assignee, stage_entered_at)
  values (p_property_id, p_unit, 0, p_vacate_date, p_target_date, p_assignee, now())
  returning * into t;

  -- Seed tasks for every stage 0–5, all unchecked, all assigned to the owner.
  insert into public.turn_tasks (turn_id, name, assignee, done, sort_order, stage_idx)
  select t.id, task.name, p_assignee, false, task.ordinality - 1, s.idx
  from generate_series(0, 5) as s(idx)
  cross join lateral unnest(public.default_tasks_for_stage(s.idx::integer))
    with ordinality as task(name, ordinality);

  return t;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Rewrite advance_turn: pointer bump only, never deletes tasks
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.advance_turn(p_turn_id uuid)
returns public.turns
language plpgsql as $$
declare
  t public.turns;
  next_stage smallint;
begin
  select * into t from public.turns where id = p_turn_id for update;
  if not found then raise exception 'turn % not found', p_turn_id; end if;
  if t.stage_idx >= 5 then raise exception 'turn already at terminal stage'; end if;

  -- Reject advance if any current-stage task is still open. Tasks at other
  -- stages don't gate the advance — they're either future (not yet relevant)
  -- or past (already settled).
  if exists (
    select 1 from public.turn_tasks
    where turn_id = p_turn_id
      and stage_idx = t.stage_idx
      and done = false
  ) then
    raise exception 'cannot advance: current-stage tasks still incomplete';
  end if;

  next_stage := t.stage_idx + 1;

  update public.turns
  set stage_idx        = next_stage,
      stage_entered_at = now()
  where id = p_turn_id
  returning * into t;

  return t;
end;
$$;
