-- Merge the Materials (stage_idx 1) and Maintenance Repairs (stage_idx 2)
-- phases into a single "Maintenance & Materials" phase. 5 phases become 4:
-- Inspection, Maintenance & Materials, Cleaning, Ready. Cleaning/Ready shift
-- from 3/4 down to 2/3.
--
-- Also drops the hold/blocked feature (turns.hold_status/hold_reason/held_at)
-- — no turn is currently on hold, so this is lossless. Historical "held"/
-- "resumed" turn_events rows are left as-is for the activity feed.
--
-- Order: remap all data first while constraints are still 0-4 (so no
-- intermediate state ever violates anything), THEN tighten every constraint
-- to 0-3, THEN swap the RPC bodies. One transaction — if anything fails,
-- nothing changes. Modeled on 0026_consolidate_painting_repairs.sql, which
-- did this exact kind of merge for a different pair of phases.

-- ── 1. turn_tasks: fold stage 2 into stage 1, then shift 3→2, 4→3 ──────────
-- Maintenance Repairs' tasks continue after that turn's existing max
-- sort_order at stage 1, so items interleave in a sane display order rather
-- than colliding.
update public.turn_tasks tt
set stage_idx = 1,
    sort_order = tt.sort_order + coalesce(
      (select max(tt2.sort_order) + 1 from public.turn_tasks tt2
       where tt2.turn_id = tt.turn_id and tt2.stage_idx = 1), 0)
where tt.stage_idx = 2;

update public.turn_tasks set stage_idx = 2 where stage_idx = 3;
update public.turn_tasks set stage_idx = 3 where stage_idx = 4;

-- ── 2. turns.stage_idx: same remap. A turn currently mid-Materials (1) and
-- one mid-Maintenance-Repairs (2) both land at 1 — an intentional no-op
-- ("both are just mid Maintenance & Materials now"). stage_entered_at is
-- preserved (work is ongoing, not restarting).
update public.turns set stage_idx = 1 where stage_idx = 2;
update public.turns set stage_idx = 2 where stage_idx = 3;
update public.turns set stage_idx = 3 where stage_idx = 4;

-- ── 3. turns.skipped_phases: per-element remap with de-duplication (a turn
-- that skipped both 1 and 2 must end up with just [1], not [1,1]) ─────────
update public.turns t
set skipped_phases = coalesce((
  select jsonb_agg(distinct mapped)
  from (
    select case (elem)::int
      when 2 then 1
      when 3 then 2
      when 4 then 3
      else (elem)::int
    end as mapped
    from jsonb_array_elements_text(coalesce(t.skipped_phases, '[]'::jsonb)) as elem
  ) s
), '[]'::jsonb)
where coalesce(t.skipped_phases, '[]'::jsonb) <> '[]'::jsonb;

-- ── 4. task_notes.stage_idx: same remap, so historical notes/photos stay
-- attached to the right task (keyed by turn_id, stage_idx, task_name) ─────
update public.task_notes set stage_idx = 1 where stage_idx = 2;
update public.task_notes set stage_idx = 2 where stage_idx = 3;
update public.task_notes set stage_idx = 3 where stage_idx = 4;

-- ── 5. stage_default_tasks: same remap. (Verified beforehand: table is
-- currently empty at every stage_idx — cleared by 0020 — so this is a no-op
-- today, kept for correctness if it's ever repopulated before this runs.) ──
update public.stage_default_tasks set stage_idx = 1 where stage_idx = 2;
update public.stage_default_tasks set stage_idx = 2 where stage_idx = 3;
update public.stage_default_tasks set stage_idx = 3 where stage_idx = 4;

-- ── 6. stage_task_templates: same remap. (Verified beforehand: no templates
-- exist at stage_idx 1 or 2 in production — no name collision to resolve.
-- If one existed, the unique(stage_idx, name) constraint would abort this
-- whole transaction rather than silently drop anything.) ──────────────────
update public.stage_task_templates set stage_idx = 1 where stage_idx = 2;
update public.stage_task_templates set stage_idx = 2 where stage_idx = 3;
update public.stage_task_templates set stage_idx = 3 where stage_idx = 4;

-- ── 7. admin_stage_config: stage_idx is the PK itself, so this is a row
-- delete for the vacated slot, then the same remap, then a contiguous
-- renumber of display_order ────────────────────────────────────────────────
delete from public.admin_stage_config where stage_idx = 2;
update public.admin_stage_config set stage_idx = 2 where stage_idx = 3;
update public.admin_stage_config set stage_idx = 3 where stage_idx = 4;

update public.admin_stage_config c
set display_order = ranked.rn - 1
from (select stage_idx, row_number() over (order by display_order) as rn
      from public.admin_stage_config) ranked
where c.stage_idx = ranked.stage_idx;

-- ── 8. Tighten CHECK constraints from 0-4 to 0-3 ───────────────────────────
alter table public.turns drop constraint turns_stage_idx_check;
alter table public.turns add constraint turns_stage_idx_check check (stage_idx between 0 and 3);

alter table public.turn_tasks drop constraint turn_tasks_stage_idx_check;
alter table public.turn_tasks add constraint turn_tasks_stage_idx_check check (stage_idx between 0 and 3);

alter table public.stage_default_tasks drop constraint stage_default_tasks_stage_idx_check;
alter table public.stage_default_tasks add constraint stage_default_tasks_stage_idx_check check (stage_idx between 0 and 3);

alter table public.stage_task_templates drop constraint stage_task_templates_stage_idx_check;
alter table public.stage_task_templates add constraint stage_task_templates_stage_idx_check check (stage_idx between 0 and 3);

alter table public.admin_stage_config drop constraint admin_stage_config_stage_idx_check;
alter table public.admin_stage_config add constraint admin_stage_config_stage_idx_check check (stage_idx between 0 and 3);

-- ── 9. RPCs: terminal stage is now 3, not 4 ────────────────────────────────
create or replace function public.advance_turn(p_turn_id uuid)
returns public.turns
language plpgsql as $$
declare
  t public.turns;
  cur smallint;
begin
  select * into t from public.turns where id = p_turn_id for update;
  if not found then raise exception 'turn % not found', p_turn_id; end if;
  if t.stage_idx >= 3 then raise exception 'turn already at terminal stage'; end if;

  if not (coalesce(t.skipped_phases, '[]'::jsonb) @> to_jsonb(t.stage_idx)) then
    if exists (
      select 1 from public.turn_tasks
      where turn_id = p_turn_id
        and stage_idx = t.stage_idx
        and done = false
        and removed = false
    ) then
      raise exception 'cannot advance: current-stage tasks still incomplete';
    end if;
  end if;

  cur := t.stage_idx;
  loop
    cur := cur + 1;
    exit when cur >= 3;
    exit when not (coalesce(t.skipped_phases, '[]'::jsonb) @> to_jsonb(cur));
  end loop;

  update public.turns
  set stage_idx        = cur,
      stage_entered_at = now()
  where id = p_turn_id
  returning * into t;

  return t;
end;
$$;

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

  insert into public.turn_tasks (turn_id, name, assignee, done, sort_order, stage_idx)
  select t.id, task.name, '', false, task.ordinality - 1, s.idx
  from generate_series(0, 3) as s(idx)
  cross join lateral unnest(public.default_tasks_for_stage(s.idx::integer))
    with ordinality as task(name, ordinality);

  return t;
end;
$$;

-- ── 10. Drop the hold/blocked feature — no turn is currently on hold ───────
alter table public.turns
  drop column if exists hold_status,
  drop column if exists hold_reason,
  drop column if exists held_at;
