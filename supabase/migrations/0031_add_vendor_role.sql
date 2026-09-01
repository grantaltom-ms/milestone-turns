-- Allow 'vendor' as a profile role, for outside contractors who need
-- app access (e.g. login to view/update their assigned turns) but
-- aren't Milestone staff.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('office_lead', 'office', 'maintenance_lead', 'maintenance', 'admin', 'vendor'));
