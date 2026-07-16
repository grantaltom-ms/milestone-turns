-- Lets a profile be assignable in every phase, regardless of the
-- office/maintenance team split that normally gates the assignee picker.
alter table public.profiles
  add column if not exists assignable_all_phases boolean not null default false;
