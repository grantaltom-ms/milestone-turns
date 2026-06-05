-- ============================================================
-- Migration 0006: profiles table + task_notes table
-- Adds magic-link auth support and per-task notes
-- ============================================================

-- ── 1. profiles ────────────────────────────────────────────
-- One row per auth user. Linked to auth.users via id.
-- name, email, role, initials are the key fields.
-- avatar_color can be set directly in Supabase by admin.

create table if not exists public.profiles (
  id           uuid        primary key references auth.users(id) on delete cascade,
  name         text        not null,
  email        text        not null,
  role         text        not null default 'maintenance'
                           check (role in ('office_lead','office','maintenance_lead','maintenance')),
  initials     text        not null,   -- e.g. "JD" computed from name on create
  avatar_color text        not null default '#697E94',
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- authenticated users can read all profiles (for assignment pickers)
create policy "profiles read"
  on public.profiles for select
  to authenticated
  using (true);

-- users can only upsert their own profile
create policy "profiles self upsert"
  on public.profiles for all
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);


-- ── 2. task_notes ──────────────────────────────────────────
-- Notes are keyed by (turn_id, stage_idx, task_name) so they
-- survive stage advances (which wipe and recreate turn_tasks).

create table if not exists public.task_notes (
  id         uuid        primary key default gen_random_uuid(),
  turn_id    uuid        not null references public.turns(id) on delete cascade,
  stage_idx  smallint    not null,
  task_name  text        not null,
  author_id  uuid        not null references public.profiles(id),
  content    text        not null check (length(trim(content)) > 0),
  created_at timestamptz not null default now()
);

alter table public.task_notes enable row level security;

-- authenticated users can read all notes
create policy "task_notes read"
  on public.task_notes for select
  to authenticated
  using (true);

-- authenticated users can insert notes
create policy "task_notes insert"
  on public.task_notes for insert
  to authenticated
  with check (auth.uid() = author_id);

-- authors can update/delete their own notes
create policy "task_notes self mutate"
  on public.task_notes for all
  to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);


-- ── 3. Tighten existing RLS: turns + turn_tasks need auth ──
-- (Dev migration 0002 opened to anon. Now we require auth.)

drop policy if exists "turns read"       on public.turns;
drop policy if exists "turns write"      on public.turns;
drop policy if exists "turn_tasks read"  on public.turn_tasks;
drop policy if exists "turn_tasks write" on public.turn_tasks;

create policy "turns read"
  on public.turns for select
  to anon, authenticated using (true);

create policy "turns write"
  on public.turns for all
  to authenticated using (true) with check (true);

create policy "turn_tasks read"
  on public.turn_tasks for select
  to anon, authenticated using (true);

create policy "turn_tasks write"
  on public.turn_tasks for all
  to authenticated using (true) with check (true);


-- ── 4. Grant RPC execute to authenticated ──────────────────
grant execute on function public.create_turn(bigint, text, date, date, text)  to authenticated;
grant execute on function public.advance_turn(uuid)                            to authenticated;
