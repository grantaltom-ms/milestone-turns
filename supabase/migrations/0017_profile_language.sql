-- Per-account UI language for bilingual (English / Spanish) support.
-- Each profile carries a language; the app renders in that language.
alter table public.profiles add column if not exists language text not null default 'en';

alter table public.profiles drop constraint if exists profiles_language_check;
alter table public.profiles
  add constraint profiles_language_check check (language in ('en', 'es'));
