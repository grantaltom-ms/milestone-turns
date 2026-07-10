import { type NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/service";
import { fetchVacantUnits } from "@/lib/appfolio";

export const dynamic = "force-dynamic";

// Secured with CRON_SECRET bearer token.
// Vercel Cron sends: Authorization: Bearer <CRON_SECRET>
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = getServiceSupabase();

  // Load enabled properties
  const { data: settings, error: sErr } = await supabase
    .from("appfolio_sync_settings")
    .select("property_id, default_assignee, properties(appfolio_id)")
    .eq("sync_enabled", true);
  if (sErr) {
    return NextResponse.json({ error: sErr.message }, { status: 500 });
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
    return NextResponse.json({ created: 0, message: "No buildings enabled for sync" });
  }

  // Fetch vacant units from AppFolio (Vacant-* only for auto-sync)
  let allUnits;
  try {
    allUnits = await fetchVacantUnits();
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AppFolio fetch failed" }, { status: 502 });
  }

  const vacantUnits = allUnits.filter(
    (u) => u.status === "Vacant-Unrented" || u.status === "Vacant-Rented",
  );

  const relevant = vacantUnits.filter((u) => enabledMap.has(String(u.property_id)));
  if (relevant.length === 0) {
    return NextResponse.json({ created: 0, message: "No vacant units at enabled buildings" });
  }

  // Load existing active turns to avoid duplicates
  const sbPropertyIds = Array.from(
    new Set(relevant.map((u) => enabledMap.get(String(u.property_id))!.sb_property_id)),
  );
  const { data: activeTurns } = await supabase
    .from("turns")
    .select("id, property_id, unit, stage_idx")
    .in("property_id", sbPropertyIds)
    .lt("stage_idx", 5);

  const turnLookup = new Map<string, string>();
  for (const t of activeTurns ?? []) {
    turnLookup.set(`${t.property_id}:${t.unit}`, t.id);
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
  const errors: string[] = [];

  for (const unit of relevant) {
    const mapping = enabledMap.get(String(unit.property_id))!;
    const key = `${mapping.sb_property_id}:${unit.unit}`;
    const existingTurnId = turnLookup.get(key);

    if (existingTurnId) {
      // Never touch anything else here — assignee, dates, notes, and task
      // state belong to the team once a turn exists. Only next_move_in is
      // AppFolio-derived and safe to keep in sync.
      const { error } = await supabase
        .from("turns")
        .update({ next_move_in: unit.next_move_in })
        .eq("id", existingTurnId);
      if (error) {
        errors.push(`${unit.property_name} #${unit.unit}: ${error.message}`);
      } else {
        updated.push(`${unit.property_name} #${unit.unit}`);
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
        await supabase
          .from("turns")
          .update({ appfolio_unit_id: unit.unit_id, next_move_in: unit.next_move_in })
          .eq("id", turn.id);
        created.push(`${unit.property_name} #${unit.unit}`);
        turnLookup.set(key, turn.id); // prevent double-create within same run
      }
    } catch (e) {
      errors.push(`${unit.property_name} #${unit.unit}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({
    created: created.length,
    updated: updated.length,
    errors: errors.length,
    detail: { created, updated, errors },
  });
}
