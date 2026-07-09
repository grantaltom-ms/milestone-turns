-- Per-person Slack member ID, so notifications can DM the assigned person
-- directly instead of posting to one shared fallback channel. Admins set
-- this per teammate on /admin/notifications. Null means "not linked yet" —
-- notifications for that person fall back to SLACK_FALLBACK_CHANNEL (or are
-- skipped if that isn't configured either).
alter table public.profiles add column if not exists slack_user_id text;
