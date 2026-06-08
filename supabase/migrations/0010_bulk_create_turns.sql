-- Feature 3.3 — Bulk-create turns with deduplication
-- Accepts a JSONB array of row objects and creates turns transactionally.
-- Rows for units that already have an active turn (stage_idx <= 4) are skipped.
-- Returns a JSONB array of {unit, status: "created"|"skipped", turn_id?}.

create or replace function public.bulk_create_turns(p_rows jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  row_obj     jsonb;
  p_prop_id   bigint;
  p_unit      text;
  p_vac       date;
  p_tgt       date;
  p_asgn      text;
  new_turn_id uuid;
  results     jsonb := '[]'::jsonb;
begin
  for row_obj in select * from jsonb_array_elements(p_rows)
  loop
    p_prop_id := (row_obj->>'property_id')::bigint;
    p_unit    := row_obj->>'unit';
    p_vac     := (row_obj->>'vacate_date')::date;
    p_tgt     := (row_obj->>'target_date')::date;
    p_asgn    := row_obj->>'assignee';

    -- Dedup: skip if an active turn already exists (stage_idx <= 4 = not yet at Ready)
    if exists (
      select 1 from public.turns
      where property_id = p_prop_id
        and unit = p_unit
        and stage_idx <= 4
    ) then
      results := results || jsonb_build_object('unit', p_unit, 'status', 'skipped');
      continue;
    end if;

    -- Insert new turn
    insert into public.turns (property_id, unit, stage_idx, vacate_date, target_date, assignee, stage_entered_at)
    values (p_prop_id, p_unit, 0, p_vac, p_tgt, p_asgn, now())
    returning id into new_turn_id;

    -- Seed tasks for all stages 0–5, matching create_turn() exactly
    insert into public.turn_tasks (turn_id, name, assignee, done, sort_order, stage_idx)
    select new_turn_id, task.name, p_asgn, false, task.ordinality - 1, s.idx
    from generate_series(0, 5) as s(idx)
    cross join lateral unnest(public.default_tasks_for_stage(s.idx::integer))
      with ordinality as task(name, ordinality);

    results := results || jsonb_build_object('unit', p_unit, 'status', 'created', 'turn_id', new_turn_id);
  end loop;

  return results;
end;
$$;

grant execute on function public.bulk_create_turns(jsonb) to authenticated;
