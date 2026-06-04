-- Fix: create_turn calls default_tasks_for_stage(0), an integer literal, but
-- the function was declared as taking smallint. Postgres function resolution
-- doesn't auto-narrow integer → smallint, so every call failed at runtime
-- with "function public.default_tasks_for_stage(integer) does not exist".
--
-- Redefine the helper to take `integer` (advance_turn's smallint widens up
-- to integer automatically, so it still works).

drop function if exists public.default_tasks_for_stage(smallint);

create or replace function public.default_tasks_for_stage(stage integer)
returns text[] language sql immutable as $$
  select case stage
    when 0 then array['Confirm vacate date','Send move-out instructions','Schedule pre-vacate walk']
    when 1 then array['Confirm keys returned','Document unit condition','Note all damage items']
    when 2 then array['Walk unit with inspector','Document all repairs needed','Get vendor quotes','Finalize scope list','Order materials','Set repair start date']
    when 3 then array['Patch & paint walls','Replace bedroom blinds','Fix garbage disposal','Replace bathroom fan']
    when 4 then array['Deep clean kitchen','Clean bathrooms','Vacuum & mop floors','Clean windows','Remove all debris']
    when 5 then array['Walk with supervisor','Verify all repairs complete','Verify cleaning complete','Sign off on unit']
    when 6 then array['Take marketing photos','Update listing','Confirm availability date']
    else array[]::text[]
  end;
$$;
