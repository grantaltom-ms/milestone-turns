-- Per-phase task templates.
--
-- A template is a named, ordered list of task names scoped to a single phase
-- (stage_idx 0–5). Admins save the current phase's default tasks as a template
-- and later load a template to repopulate that phase's defaults. This is the
-- mechanism for re-applying known task sets after 0014 emptied the defaults.
--
-- Mirrors the conventions of stage_default_tasks (0007) and the admin-only
-- write RLS pattern from 0011.

create table if not exists public.stage_task_templates (
  id          serial primary key,
  stage_idx   smallint not null check (stage_idx between 0 and 5),
  name        text not null,
  created_at  timestamptz not null default now(),
  unique (stage_idx, name)          -- one template name per phase
);

create index if not exists stage_task_templates_stage_idx
  on public.stage_task_templates (stage_idx);

create table if not exists public.stage_task_template_items (
  id           serial primary key,
  template_id  integer not null references public.stage_task_templates(id) on delete cascade,
  name         text not null,
  sort_order   smallint not null,
  unique (template_id, sort_order)
);

create index if not exists stage_task_template_items_template_id
  on public.stage_task_template_items (template_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Readable to any authenticated user (the admin board is gated at the page
-- level); writable only to admins, same predicate as 0011.
alter table public.stage_task_templates       enable row level security;
alter table public.stage_task_template_items  enable row level security;

drop policy if exists "stage_task_templates read" on public.stage_task_templates;
create policy "stage_task_templates read" on public.stage_task_templates
  for select to authenticated using (true);

drop policy if exists "stage_task_templates admin write" on public.stage_task_templates;
create policy "stage_task_templates admin write" on public.stage_task_templates
  for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "stage_task_template_items read" on public.stage_task_template_items;
create policy "stage_task_template_items read" on public.stage_task_template_items
  for select to authenticated using (true);

drop policy if exists "stage_task_template_items admin write" on public.stage_task_template_items;
create policy "stage_task_template_items admin write" on public.stage_task_template_items
  for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
