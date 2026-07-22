-- Vendor-scheduled flooring installation date, and/or (for units that don't
-- need flooring replaced) the scheduled final-cleaning date. Office enters
-- whichever applies so maintenance can see it and finish repairs beforehand.
-- Both nullable — a turn may have neither, either, or (rarely) both set.
alter table public.turns
  add column if not exists flooring_install_date date,
  add column if not exists cleaning_scheduled_date date;
