-- Empty every phase's default checklist so new turns start with blank lists.
--
-- Phase defaults are now repopulated on demand via the admin task templates
-- added in 0016: an admin loads a template into a phase to set its defaults.
-- With this table empty, default_tasks_for_stage() returns array[]::text[], so
-- create_turn() (0008) and bulk create (0010) seed zero tasks. New turns are
-- still created correctly — they just start with empty checklists.
--
-- Existing in-progress turns are untouched (their turn_tasks rows already exist
-- and are not derived from this table after creation).
--
-- Before clearing, snapshot whatever defaults currently exist into a per-phase
-- template named 'Original defaults' so nothing is lost — an admin can reload
-- them from the admin board at any time.

-- 1. Snapshot the current defaults into a template per phase that has any.
insert into public.stage_task_templates (stage_idx, name)
select distinct stage_idx, 'Original defaults'
from public.stage_default_tasks
on conflict (stage_idx, name) do nothing;

insert into public.stage_task_template_items (template_id, name, sort_order)
select t.id, d.name, d.sort_order
from public.stage_default_tasks d
join public.stage_task_templates t
  on t.stage_idx = d.stage_idx and t.name = 'Original defaults'
on conflict (template_id, sort_order) do nothing;

-- 2. Empty the defaults. Phases now start blank until an admin loads a template.
delete from public.stage_default_tasks;
