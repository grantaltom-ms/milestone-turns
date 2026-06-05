-- Phase 1.5 — One source of truth for stage default checklists.
-- Replaces the hand-maintained DEFAULT_TASKS array in lib/stages.ts.
-- The function default_tasks_for_stage() is rewritten to read from the new
-- table; both create_turn() (already calls the function) and the New Turn
-- auto-fill preview (calls a server loader) will see the same rows.

create table if not exists public.stage_default_tasks (
  id          serial primary key,
  stage_idx   smallint not null check (stage_idx between 0 and 5),
  name        text not null,
  sort_order  smallint not null,
  created_at  timestamptz not null default now()
);

create unique index if not exists stage_default_tasks_uniq
  on public.stage_default_tasks (stage_idx, sort_order);

create index if not exists stage_default_tasks_stage_idx
  on public.stage_default_tasks (stage_idx);

-- Idempotent reseed of the canonical defaults.
delete from public.stage_default_tasks;

insert into public.stage_default_tasks (stage_idx, name, sort_order) values
  (0, 'Walk unit with inspector',  0),
  (0, 'Document unit condition',   1),
  (0, 'List all repairs needed',   2),
  (0, 'Get vendor quotes',         3),
  (0, 'Build scope of work',       4),
  (1, 'Order paint',               0),
  (1, 'Order replacement parts',   1),
  (1, 'Order cleaning supplies',   2),
  (1, 'Receive materials at unit', 3),
  (2, 'Patch walls',               0),
  (2, 'Prime',                     1),
  (2, 'Paint walls',               2),
  (2, 'Paint trim',                3),
  (2, 'Touch up',                  4),
  (3, 'Plumbing fixes',            0),
  (3, 'Electrical fixes',          1),
  (3, 'Replace fixtures',          2),
  (3, 'Replace blinds',            3),
  (3, 'Appliance check',           4),
  (4, 'Deep clean kitchen',        0),
  (4, 'Clean bathrooms',           1),
  (4, 'Vacuum & mop floors',       2),
  (4, 'Clean windows',             3),
  (4, 'Remove all debris',         4),
  (5, 'Final walkthrough',         0),
  (5, 'Take marketing photos',     1),
  (5, 'Update listing',            2),
  (5, 'Confirm availability date', 3);

-- Rewrite the helper to read from the table. Now `stable` rather than
-- `immutable` because it depends on table contents.
create or replace function public.default_tasks_for_stage(stage integer)
returns text[] language sql stable as $$
  select coalesce(array_agg(name order by sort_order), array[]::text[])
  from public.stage_default_tasks
  where stage_idx = stage;
$$;

-- RLS — readable to everyone (so the New Turn preview can show it without
-- auth), writable only to authenticated users.
alter table public.stage_default_tasks enable row level security;

drop policy if exists "stage_default_tasks read"  on public.stage_default_tasks;
create policy "stage_default_tasks read" on public.stage_default_tasks
  for select to anon, authenticated using (true);

drop policy if exists "stage_default_tasks write" on public.stage_default_tasks;
create policy "stage_default_tasks write" on public.stage_default_tasks
  for all to authenticated using (true) with check (true);
