-- ============================================================
-- Migration 0011: admin role + admin-only management of
-- stage_default_tasks (the default-task checklists per phase)
-- ============================================================
-- - Adds 'admin' to the profiles.role check constraint
-- - Promotes grant@rentmilestone.com to admin (if the auth user
--   exists; if they haven't signed in yet, re-run the UPDATE at
--   the bottom after their first login)
-- - Restricts WRITE access on stage_default_tasks to admins only.
--   Everyone keeps SELECT (the New Turn preview needs it unauth'd).
--
-- Note: stage_default_tasks already has a `sort_order smallint`
-- column and a unique (stage_idx, sort_order) index from 0007,
-- so no schema change is needed for task ordering.

-- ── 1. Allow 'admin' as a profile role ─────────────────────
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('office_lead', 'office', 'maintenance_lead', 'maintenance', 'admin'));

-- ── 2. Promote grant@rentmilestone.com to admin ────────────
-- Update an existing profile row if present...
update public.profiles
  set role = 'admin'
  where lower(email) = 'grant@rentmilestone.com';

-- ...and if the auth user exists but has no profile yet, create
-- one as admin. Idempotent: re-running just keeps role = 'admin'.
insert into public.profiles (id, name, email, role, initials)
select u.id,
       coalesce(u.raw_user_meta_data ->> 'name', 'Grant'),
       u.email,
       'admin',
       'GC'
from auth.users u
where lower(u.email) = 'grant@rentmilestone.com'
on conflict (id) do update set role = 'admin';

-- ── 3. Admin-only writes on stage_default_tasks ────────────
-- Drop the old "any authenticated user can write" policy (0007).
drop policy if exists "stage_default_tasks write" on public.stage_default_tasks;
drop policy if exists "stage_default_tasks admin write" on public.stage_default_tasks;

create policy "stage_default_tasks admin write" on public.stage_default_tasks
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- The read policy from 0007 ("stage_default_tasks read", anon +
-- authenticated, using (true)) is left in place intentionally.

-- ── 4. (Re-run helper) ─────────────────────────────────────
-- If grant@rentmilestone.com signs in AFTER this migration ran,
-- run just this to promote them:
--   update public.profiles set role = 'admin'
--     where lower(email) = 'grant@rentmilestone.com';
