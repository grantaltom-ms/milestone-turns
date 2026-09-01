# Unit Turn Tracker — Milestone Properties

Mobile-first internal web app for tracking vacant apartment units through the
make-ready pipeline. Field crew on phones check tasks off; office staff at a
desk create turns, watch the board, assign work — everyone sees the same live
status thanks to Supabase Realtime.

Built from `design_handoff_unit_turn_tracker/README.md`. See that doc for the
full visual spec.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **TypeScript** + **Tailwind v4**
- **Supabase** (Postgres, Auth, Realtime) — wired against the main property
  project `augbrysfqwgekfhfokco` so the property dropdown reads real data.

## First-time setup

1. **Install deps**
   ```bash
   npm install
   ```

2. **Configure env vars** — copy `.env.example` to `.env.local` and fill in:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://augbrysfqwgekfhfokco.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   # Optional: gate the app behind /login. Leave empty for open dev mode.
   NEXT_PUBLIC_REQUIRE_AUTH=
   # Initials used when no one is signed in (dev convenience).
   NEXT_PUBLIC_DEFAULT_USER_INITIALS=TZ
   ```

3. **Apply the DB schema** — run `supabase/migrations/0001_unit_turns.sql`
   against the main property project. Easiest path: paste it into the SQL
   Editor in the Supabase dashboard and run. Idempotent — safe to re-run.

4. **Seed a few users (optional)** — once you turn on auth, each team member
   needs a row in `app_users` mapping their `auth.users.id` to their initials.
   ```sql
   insert into public.app_users (user_id, initials, name)
   values ('<uuid-from-auth.users>', 'TZ', 'Tony Z');
   ```

5. **Run the dev server**
   ```bash
   npm run dev
   ```
   Open <http://localhost:3000>. The frame mimics a 390×844 phone on desktop
   and goes full-bleed below 430px wide.

## Data model

Two app tables in the public schema (FK to existing `properties`):

| Table        | Purpose                                              |
|--------------|------------------------------------------------------|
| `turns`      | One row per vacant unit being turned                 |
| `turn_tasks` | Checklist for the current stage of each turn         |
| `app_users`  | Maps `auth.users.id` → team initials + display name  |

Two RPCs encapsulate stage transitions atomically:

- `create_turn(property_id, unit, vacate_date, target_date, assignee)` — inserts
  a turn at stage 0 (Notice) and seeds its default checklist.
- `advance_turn(turn_id)` — guards that all current-stage tasks are checked,
  then bumps `stage_idx` and replaces the checklist with the next stage's
  defaults. Throws at Make-Ready (terminal).

## Realtime

Both `turns` and `turn_tasks` are added to the `supabase_realtime` publication.
The Board and Detail screens subscribe to `postgres_changes` and call
`router.refresh()` on any event — so an office user instantly sees a checkbox
that the field crew just tapped.

## Auth

Email + password sign-in via Supabase Auth. To turn on the gate, set
`NEXT_PUBLIC_REQUIRE_AUTH=true` and create users in the Supabase Auth dashboard.
With the gate off (default for local dev) the app loads as `TZ` (or whatever
`NEXT_PUBLIC_DEFAULT_USER_INITIALS` is set to) so you can develop without auth.

## Maintenance vacancy board

A standalone, read-only page for the head of maintenance at
`/vacancies/<code>` — no sign-in, no navigation, nothing clickable into the
turns board. Two tabs:

- **Vacant Now** — every empty unit, grouped by building, with a badge showing
  how many days it has been sitting. Buildings are ordered worst-first, and the
  badge turns amber at 15 days and brick at 30.
- **Coming Up** — units whose tenant has given notice, soonest move-out first.

It reads the newest row set in `unit_vacancy_snapshots` (the daily AppFolio
unit-vacancy export), so it covers the whole portfolio rather than only the
buildings enabled for turn sync. The header shows the snapshot's date, so a
stale feed is visible rather than silently wrong.

### Setup

1. Generate a code and set it as `VACANCY_LINK_CODE` in the Vercel project
   (and `.env.local` for dev):
   ```bash
   openssl rand -hex 24
   ```
   The code is the only thing protecting the page. Anything under 16
   characters is rejected and the board returns 404 for everyone — it fails
   closed rather than going public.
2. Send him `https://milestonepm.app/vacancies/<code>` and have him add it to
   his phone's home screen.

   Use the **custom domain**, not a `*.vercel.app` URL. The project's Vercel
   deployment protection is set to `all_except_custom_domains`, so every
   `*.vercel.app` host (previews and the default production URL alike) demands
   a Vercel login first — which is exactly the friction this page exists to
   avoid. `milestonepm.app` is exempt.

To rotate the link, change the env var and redeploy; the old URL 404s
immediately.

## Testing

```bash
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm run test:unit   # node --test, pure logic
npm run test:e2e    # Playwright, drives the real page in a browser
npm test            # unit + e2e
```

The end-to-end suite runs against a **production build** (`next build && next
start`), not `next dev` — dev mode blocks cross-origin dev resources, so
nothing hydrates under test. It serves fixture data from a mock PostgREST
server (`tests/support/mock-supabase.ts`), so it never touches Supabase or
AppFolio and the expected day counts stay stable whenever it runs.

In a sandbox with Chromium already installed, point Playwright at it instead
of downloading one:

```bash
PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e
```

GitHub Actions runs lint, typecheck, unit tests, build and the browser suite on
every push and pull request (`.github/workflows/ci.yml`).

## Deploy

Push to Vercel. Set the four env vars in the Vercel project settings. Done.
