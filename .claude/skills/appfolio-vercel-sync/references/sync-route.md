# AppFolio Sync Route — Full Pattern

## Route structure

```
app/api/appfolio/sync/route.ts
```

## CRON_SECRET auth

Secure the route so only Vercel Cron (or an authorized caller) can trigger it:

```typescript
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  // ...
}
```

Vercel Cron automatically sends `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is set as an env var on the project. You can also trigger manually with `curl -H "Authorization: Bearer $CRON_SECRET" https://yourapp.vercel.app/api/appfolio/sync`.

## Loading the property mapping

You need a mapping from AppFolio property IDs to your internal property IDs (e.g., Supabase row IDs). Store this in a `appfolio_sync_settings` or similar table with:
- `property_id` (your internal ID)
- `appfolio_id` (the AppFolio property ID string/number)
- `sync_enabled` (boolean — only sync enabled properties)
- `default_assignee` (who new turns are assigned to)

```typescript
const { data: settings } = await supabase
  .from("appfolio_sync_settings")
  .select("property_id, default_assignee, properties(appfolio_id)")
  .eq("sync_enabled", true);

const enabledMap = new Map<string, { sb_property_id: number; default_assignee: string }>();
for (const row of settings ?? []) {
  if (row.properties?.appfolio_id) {
    enabledMap.set(row.properties.appfolio_id, {
      sb_property_id: row.property_id,
      default_assignee: row.default_assignee,
    });
  }
}
```

## Unit name normalization

Always normalize before comparing — AppFolio and manual entries may differ:

```typescript
function normalizeUnit(u: string): string {
  return u.replace(/^#+/, "").replace(/[\s\-]+/g, " ").trim().toLowerCase();
}
```

Examples: `"#4"` → `"4"`, `"B - 212"` → `"b 212"`, `"B 212"` → `"b 212"`

## Dedup lookup

Build a lookup of existing (non-archived) turns keyed by normalized `property_id:unit`:

```typescript
const { data: existingTurns } = await supabase
  .from("turns")
  .select("id, property_id, unit, stage_idx")
  .in("property_id", sbPropertyIds)
  .is("archived_at", null);

const turnLookup = new Map<string, string>(); // key → turn id
for (const t of existingTurns ?? []) {
  turnLookup.set(`${t.property_id}:${normalizeUnit(t.unit)}`, t.id);
}
```

## Create / update loop

```typescript
for (const unit of relevantVacantUnits) {
  const mapping = enabledMap.get(String(unit.property_id))!;
  const key = `${mapping.sb_property_id}:${normalizeUnit(unit.unit)}`;
  const existingTurnId = turnLookup.get(key);

  if (existingTurnId) {
    // Already have a turn — only update fields AppFolio owns
    if (unit.next_move_in) {
      await supabase
        .from("turns")
        .update({ next_move_in: unit.next_move_in })
        .eq("id", existingTurnId);
    }
    continue;
  }

  // New turn — create it
  const vacateDate = unit.last_move_out ?? todayStr;
  const targetDate = addDays(vacateDate, 14); // 14-day default target

  const { data, error } = await supabase.rpc("create_turn", {
    p_property_id: mapping.sb_property_id,
    p_unit: unit.unit,
    p_vacate_date: vacateDate,
    p_target_date: targetDate,
    p_assignee: mapping.default_assignee || "??",
  });
  if (error) throw error;

  const turn = Array.isArray(data) ? data[0] : data;
  if (turn?.id) {
    const patch: Record<string, unknown> = { appfolio_unit_id: unit.unit_id };
    if (unit.next_move_in) patch.next_move_in = unit.next_move_in;
    await supabase.from("turns").update(patch).eq("id", turn.id);
    turnLookup.set(key, turn.id); // prevent double-create within same run
  }
}
```

## Auto-archive (terminal-stage only)

When a unit no longer appears in AppFolio's vacancy feed, it's been moved into.
**Only archive turns already at the terminal "Ready" stage** — never archive in-progress work
because AppFolio can lag behind reality:

```typescript
// Build the set of all units still appearing in AppFolio (any status)
const stillListedKeys = new Set(
  allUnits
    .filter((u) => enabledMap.has(String(u.property_id)))
    .map((u) => `${enabledMap.get(String(u.property_id))!.sb_property_id}:${normalizeUnit(u.unit)}`),
);

// Archive Ready turns that have fallen off the feed
const readyTurns = (existingTurns ?? []).filter((t) => t.stage_idx === READY_STAGE_IDX);
for (const t of readyTurns) {
  if (stillListedKeys.has(`${t.property_id}:${normalizeUnit(t.unit)}`)) continue;
  await supabase
    .from("turns")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", t.id);
}
```

Replace `READY_STAGE_IDX` with your actual terminal stage index (e.g., `4`).

## Response shape

Return a summary so you can verify in Vercel logs:

```typescript
return NextResponse.json({
  created: created.length,
  updated: updated.length,
  skipped: skipped.length,
  archived: archived.length,
  errors: errors.length,
  detail: { created, updated, skipped, archived, errors },
});
```

## Full file skeleton

```typescript
import { type NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/service";
import { fetchReport } from "@/lib/appfolio";
import type { UnitVacancyRow } from "@/lib/appfolio";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Auth
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = getServiceSupabase();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // Load enabled properties
  // ... (see "Loading the property mapping" above)

  // Fetch AppFolio data
  let allUnits: UnitVacancyRow[];
  try {
    allUnits = await fetchReport<UnitVacancyRow>("unit_vacancy");
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AppFolio fetch failed" },
      { status: 502 },
    );
  }

  // ... dedup, create/update, archive (see sections above)

  return NextResponse.json({ created: ..., updated: ..., archived: ..., errors: ... });
}
```
