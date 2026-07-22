-- Consolidate the Painting (stage_idx 2) and Repairs (stage_idx 3) phases into
-- a single "Maintenance Repairs" phase. 6 phases become 5: Inspection,
-- Materials, Maintenance Repairs, Cleaning, Ready. Cleaning/Ready shift from
-- 4/5 down to 3/4.
--
-- Order: remap all data first while constraints are still 0-5 (so no
-- intermediate state ever violates anything), THEN tighten every constraint
-- to 0-4, THEN swap the RPC bodies. One transaction — if anything fails,
-- nothing changes.

-- ── 1. turn_tasks: fold stage 3 into stage 2, then shift 4→3, 5→4 ──────────
-- Repairs' tasks continue after that turn's existing max sort_order at stage
-- 2, so items interleave in a sane display order rather than colliding.
update public.turn_tasks tt
set stage_idx = 2,
    sort_order = tt.sort_order + coalesce(
      (select max(tt2.sort_order) + 1 from public.turn_tasks tt2
       where tt2.turn_id = tt.turn_id and tt2.stage_idx = 2), 0)
where tt.stage_idx = 3;

update public.turn_tasks set stage_idx = 3 where stage_idx = 4;
update public.turn_tasks set stage_idx = 4 where stage_idx = 5;

-- ── 2. turns.stage_idx: same remap. A turn currently mid-Painting (2) and one
-- mid-Repairs (3) both land at 2 — an intentional no-op ("both are just mid
-- Maintenance Repairs now"). stage_entered_at is preserved (work is ongoing,
-- not restarting).
update public.turns set stage_idx = 2 where stage_idx = 3;
update public.turns set stage_idx = 3 where stage_idx = 4;
update public.turns set stage_idx = 4 where stage_idx = 5;

-- ── 3. turns.skipped_phases: per-element remap with de-duplication (a turn
-- that skipped both 2 and 3 must end up with just [2], not [2,2]) ─────────
update public.turns t
set skipped_phases = coalesce((
  select jsonb_agg(distinct mapped)
  from (
    select case (elem)::int
      when 3 then 2
      when 4 then 3
      when 5 then 4
      else (elem)::int
    end as mapped
    from jsonb_array_elements_text(coalesce(t.skipped_phases, '[]'::jsonb)) as elem
  ) s
), '[]'::jsonb)
where coalesce(t.skipped_phases, '[]'::jsonb) <> '[]'::jsonb;

-- ── 4. task_notes.stage_idx: same remap, so historical notes/photos stay
-- attached to the right task (keyed by turn_id, stage_idx, task_name) ─────
update public.task_notes set stage_idx = 2 where stage_idx = 3;
update public.task_notes set stage_idx = 3 where stage_idx = 4;
update public.task_notes set stage_idx = 4 where stage_idx = 5;

-- ── 5. stage_task_templates: same remap. (Verified beforehand: only one
-- template exists in production, at stage_idx 0 — no name collision to
-- resolve at 2/3. If a real collision existed, the unique(stage_idx, name)
-- constraint would abort this whole transaction rather than silently drop
-- anything.) ────────────────────────────────────────────────────────────
update public.stage_task_templates set stage_idx = 2 where stage_idx = 3;
update public.stage_task_templates set stage_idx = 3 where stage_idx = 4;
update public.stage_task_templates set stage_idx = 4 where stage_idx = 5;

-- ── 6. admin_stage_config: stage_idx is the PK itself, so this is a row
-- delete for the vacated slot, then the same remap, then a contiguous
-- renumber of display_order (identity 0..5 in production today, but this
-- stays correct even if an admin had customized ordering) ────────────────
delete from public.admin_stage_config where stage_idx = 3;
update public.admin_stage_config set stage_idx = 3 where stage_idx = 4;
update public.admin_stage_config set stage_idx = 4 where stage_idx = 5;

update public.admin_stage_config c
set display_order = ranked.rn - 1
from (select stage_idx, row_number() over (order by display_order) as rn
      from public.admin_stage_config) ranked
where c.stage_idx = ranked.stage_idx;

-- ── 7. Tighten CHECK constraints from 0-5 to 0-4 ───────────────────────────
alter table public.turns drop constraint turns_stage_idx_check;
alter table public.turns add constraint turns_stage_idx_check check (stage_idx between 0 and 4);

alter table public.turn_tasks drop constraint turn_tasks_stage_idx_check;
alter table public.turn_tasks add constraint turn_tasks_stage_idx_check check (stage_idx between 0 and 4);

alter table public.stage_default_tasks drop constraint stage_default_tasks_stage_idx_check;
alter table public.stage_default_tasks add constraint stage_default_tasks_stage_idx_check check (stage_idx between 0 and 4);

alter table public.stage_task_templates drop constraint stage_task_templates_stage_idx_check;
alter table public.stage_task_templates add constraint stage_task_templates_stage_idx_check check (stage_idx between 0 and 4);

alter table public.admin_stage_config drop constraint admin_stage_config_stage_idx_check;
alter table public.admin_stage_config add constraint admin_stage_config_stage_idx_check check (stage_idx between 0 and 4);

-- ── 8. RPCs: terminal stage is now 4, not 5 ────────────────────────────────
create or replace function public.advance_turn(p_turn_id uuid)
returns public.turns
language plpgsql as $$
declare
  t public.turns;
  cur smallint;
begin
  select * into t from public.turns where id = p_turn_id for update;
  if not found then raise exception 'turn % not found', p_turn_id; end if;
  if t.stage_idx >= 4 then raise exception 'turn already at terminal stage'; end if;

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
    exit when cur >= 4;
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
  select t.id, task.name, p_assignee, false, task.ordinality - 1, s.idx
  from generate_series(0, 4) as s(idx)
  cross join lateral unnest(public.default_tasks_for_stage(s.idx::integer))
    with ordinality as task(name, ordinality);

  return t;
end;
$$;

-- bulk_create_turns' active-turn dedup filter (only the "< 5" → "< 4" changes;
-- everything else is identical to the current body in 0010_bulk_create_turns.sql)
create or replace function public.bulk_create_turns(p_rows jsonb)
returns jsonb
language plpgsql as $$
declare
  r jsonb;
  result jsonb := '[]'::jsonb;
  existing_id uuid;
  new_turn public.turns;
begin
  for r in select * from jsonb_array_elements(p_rows)
  loop
    -- Dedup check
    select id into existing_id
    from public.turns
    where property_id = (r->>'property_id')::int
      and unit = r->>'unit'
      and stage_idx < 4
    limit 1;

    if existing_id is not null then
      result := result || jsonb_build_array(
        jsonb_build_object('unit', r->>'unit', 'status', 'skipped', 'reason', 'already_active')
      );
      continue;
    end if;

    insert into public.turns (property_id, unit, vacate_date, target_date, assignee, stage_idx, stage_entered_at)
    values (
      (r->>'property_id')::int,
      r->>'unit',
      (r->>'vacate_date')::date,
      (r->>'target_date')::date,
      r->>'assignee',
      0,
      now()
    )
    returning * into new_turn;

    insert into public.turn_tasks (turn_id, name, stage_idx, assignee, done, sort_order)
    select new_turn.id, sdt.name, sdt.stage_idx, new_turn.assignee, false, sdt.sort_order
    from public.stage_default_tasks sdt
    order by sdt.stage_idx, sdt.sort_order;

    result := result || jsonb_build_array(
      jsonb_build_object('unit', r->>'unit', 'status', 'created', 'turn_id', new_turn.id)
    );
  end loop;
  return result;
end;
$$;
