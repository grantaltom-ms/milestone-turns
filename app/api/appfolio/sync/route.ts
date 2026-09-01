import { type NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/service";
import { type AppfolioVacantUnit, fetchVacantUnits } from "@/lib/appfolio";
import { todayInSeattle } from "@/lib/vacancy-board";
import { buildSnapshotRows, type PropertyRef } from "@/lib/vacancy-snapshot";

export const dynamic = "force-dynamic";

type SnapshotResult = {
  snapshot_date: string;
  written: number;
  /** AppFolio buildings with no row in `properties` — see buildSnapshotRows. */
  unresolved: string[];
  error?: string;
};

/**
 * Write the day's portfolio-wide vacancy snapshot.
 *
 * Upserts on the table's natural key (snapshot_date, property_name, unit) so a
 * re-run — a manual retry, or a Vercel retry after a timeout — updates the
 * day's rows instead of failing on the unique index.
 */
async function writeVacancySnapshot(
  supabase: ReturnType<typeof getServiceSupabase>,
  units: AppfolioVacantUnit[],
): Promise<SnapshotResult> {
  const snapshotDate = todayInSeattle();
  try {
    const { data: properties, error: pErr } = await supabase
      .from("properties")
      .select("id, name, appfolio_id")
      .eq("is_group", false);
    if (pErr) throw pErr;

    const { rows, unresolved } = buildSnapshotRows(
      units,
      (properties ?? []) as PropertyRef[],
      snapshotDate,
    );
    if (rows.length === 0) {
      return { snapshot_date: snapshotDate, written: 0, unresolved };
    }

    const { error } = await supabase
      .from("unit_vacancy_snapshots")
      .upsert(rows, { onConflict: "snapshot_date,property_name,unit" });
    if (error) throw error;

    return { snapshot_date: snapshotDate, written: rows.length, unresolved };
  } catch (e) {
    return {
      snapshot_date: snapshotDate,
      written: 0,
      unresolved: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// Secured with CRON_SECRET bearer token.
// Vercel Cron always invokes cron paths with GET (never POST) and sends
// Authorization: Bearer <CRON_SECRET> — this was previously POST-only, so
// every scheduled run 405'd before any sync logic ever ran.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = getServiceSupabase();

  // Fetch every vacant/notice unit from AppFolio. The create/update pass
  // below only acts on Vacant-*, but auto-archiving (further down) needs the
  // full set — Notice-* means a tenant gave notice, not that the unit is
  // occupied, so it must NOT be treated as "no longer needs a turn".
  //
  // This runs before anything reads the per-building sync settings: the daily
  // snapshot written next covers the whole portfolio, not just the buildings
  // opted into turn creation, so it must not sit behind that gate.
  let allUnits;
  try {
    allUnits = await fetchVacantUnits();
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AppFolio fetch failed" }, { status: 502 });
  }

  // Record today's portfolio-wide vacancy snapshot. This is what the
  // maintenance vacancy board reads, and it was previously only ever
  // populated by hand-uploaded CSVs — so the board silently aged whenever
  // nobody remembered to upload. A snapshot failure must not take the turn
  // sync down with it, so it is reported rather than thrown.
  const snapshot = await writeVacancySnapshot(supabase, allUnits);

  // Load enabled properties
  const { data: settings, error: sErr } = await supabase
    .from("appfolio_sync_settings")
    .select("property_id, default_assignee, properties(appfolio_id)")
    .eq("sync_enabled", true);
  if (sErr) {
    return NextResponse.json({ error: sErr.message, snapshot }, { status: 500 });
  }

  type SettingRow = {
    property_id: number;
    default_assignee: string;
    properties: { appfolio_id: string | null } | null;
  };

  const enabledMap = new Map<string, { sb_property_id: number; default_assignee: string }>();
  for (const row of (settings ?? []) as unknown as SettingRow[]) {
    if (row.properties?.appfolio_id) {
      enabledMap.set(row.properties.appfolio_id, {
        sb_property_id: row.property_id,
        default_assignee: row.default_assignee,
      });
    }
  }

  if (enabledMap.size === 0) {
    return NextResponse.json({ created: 0, snapshot, message: "No buildings enabled for sync" });
  }

  const sbPropertyIds = Array.from(new Set(Array.from(enabledMap.values()).map((m) => m.sb_property_id)));

  // Normalize unit names for comparison: strip leading #, collapse any
  // combination of spaces/dashes to a single space, lowercase. This lets
  // "#4" match "4", "B - 212" match "B 212", etc. — AppFolio drops the #
  // and omits dashes that manual imports sometimes include.
  function normalizeUnit(u: string): string {
    return u.replace(/^#+/, "").replace(/[\s\-]+/g, " ").trim().toLowerCase();
  }

  // Every unit AppFolio still lists (any vacant/notice status) at an enabled
  // property, keyed the same way as turnLookup below (normalized).
  const stillListedKeys = new Set(
    allUnits
      .filter((u) => enabledMap.has(String(u.property_id)))
      .map((u) => `${enabledMap.get(String(u.property_id))!.sb_property_id}:${normalizeUnit(u.unit)}`),
  );

  const vacantUnits = allUnits.filter(
    (u) => u.status === "Vacant-Unrented" || u.status === "Vacant-Rented",
  );
  const relevant = vacantUnits.filter((u) => enabledMap.has(String(u.property_id)));

  // Load existing (non-archived) turns at enabled properties — used both for
  // dedup/next_move_in updates below, and to find Ready turns to archive.
  // A Ready turn still counts as "existing" (not just stage_idx < terminal),
  // so sync/CSV import/the admin "+ Create Turn" button never offer to
  // create a duplicate for a unit that already has a completed turn sitting
  // there un-archived.
  const { data: existingTurns } = await supabase
    .from("turns")
    .select("id, property_id, unit, stage_idx")
    .in("property_id", sbPropertyIds)
    .is("archived_at", null);

  const turnLookup = new Map<string, string>(); // normalized key → turn id
  for (const t of existingTurns ?? []) {
    turnLookup.set(`${t.property_id}:${normalizeUnit(t.unit)}`, t.id);
  }

  // Today for fallback vacate/target dates
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  function addDays(iso: string, n: number): string {
    const d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  const created: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];
  const archived: string[] = [];

  for (const unit of relevant) {
    const mapping = enabledMap.get(String(unit.property_id))!;
    const key = `${mapping.sb_property_id}:${normalizeUnit(unit.unit)}`;
    const existingTurnId = turnLookup.get(key);

    if (existingTurnId) {
      // Turn already exists — sync next_move_in unconditionally so a lease
      // falling through (Vacant-Rented → Vacant-Unrented) clears the stale date.
      try {
        await supabase
          .from("turns")
          .update({ next_move_in: unit.next_move_in ?? null })
          .eq("id", existingTurnId);
        if (unit.next_move_in) {
          updated.push(`${unit.property_name} #${unit.unit}`);
        } else {
          skipped.push(`${unit.property_name} #${unit.unit}`);
        }
      } catch (e) {
        errors.push(`update ${unit.property_name} #${unit.unit}: ${e instanceof Error ? e.message : String(e)}`);
      }
      continue;
    }

    const vacateDate = unit.last_move_out ?? todayStr;
    const targetDate = addDays(vacateDate, 14);
    const assignee = mapping.default_assignee || "??";

    try {
      const { data, error } = await supabase.rpc("create_turn", {
        p_property_id: mapping.sb_property_id,
        p_unit: unit.unit,
        p_vacate_date: vacateDate,
        p_target_date: targetDate,
        p_assignee: assignee,
      });
      if (error) throw error;

      const turn = Array.isArray(data) ? data[0] : data;
      if (turn?.id) {
        const patch: Record<string, unknown> = { appfolio_unit_id: unit.unit_id };
        if (unit.next_move_in) patch.next_move_in = unit.next_move_in;
        await supabase.from("turns").update(patch).eq("id", turn.id);
        created.push(`${unit.property_name} #${unit.unit}`);
        turnLookup.set(key, turn.id); // prevent double-create within same run
      }
    } catch (e) {
      errors.push(`${unit.property_name} #${unit.unit}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Auto-archive: a Ready turn whose unit no longer appears anywhere in
  // AppFolio's vacant/notice feed is presumed occupied (moved into) — clear
  // it off the active board. Only ever touches turns already at Ready;
  // in-progress work is never hidden based on an AppFolio field that could
  // lag reality. Soft delete (archived_at), not destroyed — still reachable
  // by direct link and in the admin activity feed.
  const readyTurns = (existingTurns ?? []).filter((t) => t.stage_idx === 4);
  for (const t of readyTurns) {
    if (stillListedKeys.has(`${t.property_id}:${normalizeUnit(t.unit)}`)) continue;
    try {
      await supabase.from("turns").update({ archived_at: new Date().toISOString() }).eq("id", t.id);
      archived.push(t.id);
    } catch (e) {
      errors.push(`archive ${t.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({
    created: created.length,
    updated: updated.length,
    skipped: skipped.length,
    archived: archived.length,
    errors: errors.length,
    snapshot,
    detail: { created, updated, skipped, archived, errors },
  });
}
