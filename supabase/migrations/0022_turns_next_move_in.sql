-- Scheduled move-in date for the unit's next tenant, sourced from AppFolio's
-- unit_vacancy report (next_move_in — only populated once a vacant unit has
-- an already-signed lease). Drives a "days till move-in" countdown so the
-- team can see and prioritize upcoming move-ins.
--
-- The AppFolio sync only ever writes THIS column on an existing turn — it
-- never touches assignee, vacate/target dates, notes, or task state, so
-- syncing can't clobber anything the team has already set.
alter table public.turns add column if not exists next_move_in date;
