-- Feature 2.2 — stage reversion RPC
-- Decrements stage_idx by 1. Raises if already at stage 0.
-- Task history is preserved (per spec 1.3) — completed tasks stay done.

create or replace function public.revert_turn(p_turn_id uuid, p_reason text)
returns public.turns
language plpgsql as $$
declare
  t public.turns;
begin
  select * into t from public.turns where id = p_turn_id for update;
  if not found then raise exception 'turn % not found', p_turn_id; end if;
  if t.stage_idx = 0 then raise exception 'already at first stage'; end if;

  update public.turns
    set stage_idx        = stage_idx - 1,
        stage_entered_at = now()
    where id = p_turn_id
    returning * into t;
  return t;
end;
$$;
