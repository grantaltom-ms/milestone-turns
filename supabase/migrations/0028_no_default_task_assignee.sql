-- Stop defaulting a new task's assignee to the turn's owner. Tasks now seed
-- (and get manually added) unassigned ("") until someone explicitly assigns
-- them — matches app/actions.ts's addTaskAction, updated in the same change.
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
  from generate_series(0, 4) as s(idx)
  cross join lateral unnest(public.default_tasks_for_stage(s.idx::integer))
    with ordinality as task(name, ordinality);

  return t;
end;
$$;

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
    select new_turn.id, sdt.name, sdt.stage_idx, '', false, sdt.sort_order
    from public.stage_default_tasks sdt
    order by sdt.stage_idx, sdt.sort_order;

    result := result || jsonb_build_array(
      jsonb_build_object('unit', r->>'unit', 'status', 'created', 'turn_id', new_turn.id)
    );
  end loop;
  return result;
end;
$$;
