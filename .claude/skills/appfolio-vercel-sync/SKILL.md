---
name: appfolio-vercel-sync
description: >
  Full playbook for connecting AppFolio Property Manager to a Vercel-hosted Next.js application.
  Use this skill whenever the user wants to: pull any AppFolio report (unit vacancy, income
  statement, balance sheet, delinquency, general ledger, work orders), set up a scheduled sync
  cron job on Vercel, wire AppFolio credentials as Vercel environment variables, implement
  dedup/upsert/archive sync logic with Supabase, or debug AppFolio API errors. Also trigger
  when the user mentions "AppFolio", "unit vacancy sync", "nightly property sync", or "AppFolio
  cron". This skill contains battle-tested patterns from a production implementation — use it
  even if the request seems simple, since the gotchas (GET vs POST cron, unit name normalization,
  CRON_SECRET auth) are easy to get wrong.
---

# AppFolio ↔ Vercel Sync Playbook

This skill covers the full stack for syncing AppFolio data into a Vercel Next.js app with Supabase.
It is drawn from a working production implementation.

## Quick reference: the four critical gotchas

Before writing any code, internalize these — they're the most common failure modes:

1. **Vercel Cron always sends GET, never POST.** Your cron API route must export `async function GET(...)`, not POST. Every Vercel Cron invocation that hits a POST-only handler silently 405s and the sync never runs.

2. **AppFolio report fetches ARE POST.** The Vercel cron handler itself is GET, but internally when you call AppFolio's `/api/v2/reports/*.json` you still POST with `{ paginate_results: true }` in the body.

3. **Unit names need normalization before dedup.** AppFolio drops the `#` prefix (`#4` → `4`) and sometimes uses different dash/space patterns (`B - 212` vs `B 212`). Always normalize before comparing: strip leading `#`, collapse any run of spaces or dashes to a single space, lowercase.

4. **Never auto-archive in-progress turns.** Only archive turns at the terminal "Ready" stage based on AppFolio vacancy status changes. Archiving in-progress work because AppFolio lags behind reality destroys data.

---

## Authentication & environment setup

### Required env vars

```
APPFOLIO_CLIENT_ID=your_client_id
APPFOLIO_CLIENT_SECRET=your_client_secret
APPFOLIO_SUBDOMAIN=yourcompany.appfolio.com   # full hostname, no https://
CRON_SECRET=some_random_secret               # secures your /api/*/sync route
```

Set all four in Vercel → Project Settings → Environment Variables (Production + Preview + Development).

### How to get AppFolio API credentials

AppFolio v2 API uses **HTTP Basic Auth** with an API client ID and secret.
- In AppFolio: Settings → API Access → Create API Client
- The client needs `Read` access to the reports you'll query
- The subdomain is `yourcompanyname.appfolio.com`

See `references/auth-and-client.md` for the TypeScript client boilerplate.

---

## AppFolio report endpoints

All reports share the same pattern:
- **URL**: `https://{subdomain}/api/v2/reports/{report_name}.json`
- **Method**: POST
- **Body**: `{ paginate_results: true, ...report_specific_filters }`
- **Auth**: `Authorization: Basic base64(clientId:clientSecret)`
- **Pagination**: follow `next_page_url` in the response until it's null/absent

See `references/reports.md` for the full list of supported endpoints, their request filters, and field schemas.

---

## Vercel Cron setup

Add to `vercel.json` at the repo root:

```json
{
  "crons": [
    {
      "path": "/api/appfolio/sync",
      "schedule": "0 8 * * *"
    }
  ]
}
```

Cron schedule is UTC. `0 8 * * *` = 8am UTC daily.
Vercel's free plan allows one cron per project; paid plans allow more.

---

## Next.js cron route skeleton

```typescript
// app/api/appfolio/sync/route.ts
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Vercel Cron sends GET — never POST. Handler MUST be GET.
export async function GET(req: NextRequest) {
  // Secure with CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // ... sync logic here
}
```

See `references/sync-route.md` for the full dedup/upsert/archive sync pattern with Supabase.

---

## Dedup and unit normalization

Always normalize unit names before storing or comparing them:

```typescript
function normalizeUnit(u: string): string {
  return u.replace(/^#+/, "").replace(/[\s\-]+/g, " ").trim().toLowerCase();
}
```

Build your dedup lookup with normalized keys:
```typescript
const turnLookup = new Map<string, string>(); // "property_id:normalized_unit" → turn id
for (const t of existingTurns) {
  turnLookup.set(`${t.property_id}:${normalizeUnit(t.unit)}`, t.id);
}
```

---

## Reference files

- **`references/auth-and-client.md`** — Full TypeScript API client with auth, fetch, pagination, error handling
- **`references/reports.md`** — All supported report endpoints: unit_vacancy, income_statement, balance_sheet, delinquency, general_ledger, work_order — with request filters and field schemas
- **`references/sync-route.md`** — Complete sync route: dedup lookup, create/update turns, auto-archive, response shape
