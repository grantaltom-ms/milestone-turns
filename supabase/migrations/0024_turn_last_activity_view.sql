-- One row per turn holding its most recent turn_events timestamp. Backs the
-- "Stale - Not Ready" board filter (turns with no activity in 7+ days).
create or replace view public.turn_last_activity
with (security_invoker = true) as
select turn_id, max(created_at) as last_activity_at
from public.turn_events
group by turn_id;
