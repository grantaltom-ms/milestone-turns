-- Scheduled move-in date for the next resident. Drives turn prioritization
-- (how urgent a turn is vs. how much make-ready work is left). Nullable:
-- a unit with no signed next lease has no move-in date yet.
alter table public.turns add column if not exists move_in_date date;
