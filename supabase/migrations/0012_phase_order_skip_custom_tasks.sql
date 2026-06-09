-- ============================================================
-- Migration 0012: admin phase display-order + per-turn flexibility
-- ============================================================
-- Part 1 (admin): admin_stage_config gives phases a display_order
--   used ONLY by the /admin UI. It never touches stage_idx, so no
--   turn/turn_task data is affected.
-- Part 2 (per-turn):
--   - turns.skipped_phases jsonb[] of stage_idx values skipped on a turn
--   - turn_tasks.is_custom  (one-off task added for this turn)
--   - turn_tasks.removed    (default task soft-removed for this turn)
--   - advance_turn() bypasses the completion gate for a skipped current
--     stage and ignores removed tasks.

-- ── Part 1: phase display order (admin-only, display-only) ─────────────────
create table if not exists public.admin_stage_config (
  stage_idx     smallint primary key check (stage_idx between 0 and 5),
  display_order smallint not null,
  updated_at    timestamptz not null default now()
);

-- Seed identity order (0..5) if empty.
insert into public.admin_stage_config (stage_idx, display_order)
select s.idx, s.idx from generate_series(0, 5) as s(idx)
on conflict (stage_idx) do nothing;

alter table public.admin_stage_config enable row level security;

drop policy if exists "admin_stage_config read" on public.admin_stage_config;
create policy "admin_stage_config read" on public.admin_stage_config
  for select to anon, authenticated using (true);

drop policy if exists "admin_stage_config admin write" on public.admin_stage_config;
create policy "admin_stage_config admin write" on public.admin_stage_config
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ── Part 2a: per-turn skipped phases ───────────────────────────────────────
alter table public.turns
  add column if not exists skipped_phases jsonb not null default '[]'::jsonb;

-- ── Part 2b: per-turn task flags ───────────────────────────────────────────
alter table public.turn_tasks
  add column if not exists is_custom boolean not null default false,
  add column if not exists removed   boolean not null default false;

-- ── Part 2c: advance_turn respects skip + removed ──────────────────────────
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

  -- Completion gate applies only when the current stage is NOT skipped.
  -- Removed (soft-deleted) tasks never gate the advance.
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

  next_stage := t.stage_idx + 1;

  update public.turns
  set stage_idx        = next_stage,
      stage_entered_at = now()
  where id = p_turn_id
  returning * into t;

  return t;
end;
$$;
