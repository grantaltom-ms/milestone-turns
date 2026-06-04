-- Redesign the unit-turn pipeline:
--   0 Inspection · 1 Materials · 2 Painting · 3 Repairs · 4 Cleaning · 5 Ready
--
-- All existing turns currently sit at stage_idx 0 (formerly Notice, now
-- Inspection). Their task lists are stale, so we wipe and re-seed every
-- turn's checklist from the new defaults for its current stage.

-- 1. Update the stage_idx check constraint
alter table public.turns drop constraint if exists turns_stage_idx_check;
alter table public.turns
  add constraint turns_stage_idx_check
  check (stage_idx between 0 and 5);

-- 2. Rewrite the default-task helper
create or replace function public.default_tasks_for_stage(stage integer)
returns text[] language sql immutable as $$
  select case stage
    when 0 then array['Walk unit with inspector','Document unit condition','List all repairs needed','Get vendor quotes','Build scope of work']
    when 1 then array['Order paint','Order replacement parts','Order cleaning supplies','Receive materials at unit']
    when 2 then array['Patch walls','Prime','Paint walls','Paint trim','Touch up']
    when 3 then array['Plumbing fixes','Electrical fixes','Replace fixtures','Replace blinds','Appliance check']
    when 4 then array['Deep clean kitchen','Clean bathrooms','Vacuum & mop floors','Clean windows','Remove all debris']
    when 5 then array['Final walkthrough','Take marketing photos','Update listing','Confirm availability date']
    else array[]::text[]
  end;
$$;

-- 3. Re-seed every existing turn's checklist from the new defaults
delete from public.turn_tasks;

insert into public.turn_tasks (turn_id, name, assignee, done, sort_order)
select
  t.id,
  task.name,
  t.assignee,
  false,
  task.ordinality - 1
from public.turns t
cross join lateral unnest(public.default_tasks_for_stage(t.stage_idx::integer))
  with ordinality as task(name, ordinality);
