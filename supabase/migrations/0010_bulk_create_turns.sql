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
      and stage_idx < 5
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
