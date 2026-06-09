-- ============================================================
-- Migration 0013: advance_turn auto-jumps consecutive skipped phases
-- ============================================================
-- Builds on 0012. Advancing now lands on the first NON-skipped stage at or
-- after stage_idx+1 (capped at stage 5 / Ready, which is never skippable).
-- The completion gate still applies to the DEPARTURE stage only, and only
-- when that stage is not itself skipped. Removed tasks never gate.

create or replace function public.advance_turn(p_turn_id uuid)
returns public.turns
language plpgsql as $$
declare
  t public.turns;
  cur smallint;
begin
  select * into t from public.turns where id = p_turn_id for update;
  if not found then raise exception 'turn % not found', p_turn_id; end if;
  if t.stage_idx >= 5 then raise exception 'turn already at terminal stage'; end if;

  -- Gate the departure stage: only when it is NOT skipped. Removed
  -- (soft-deleted) tasks never gate the advance.
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

  -- Advance at least one stage, then keep hopping over skipped stages until
  -- we reach a non-skipped stage or the terminal stage (5 / Ready).
  cur := t.stage_idx;
  loop
    cur := cur + 1;
    exit when cur >= 5;
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
