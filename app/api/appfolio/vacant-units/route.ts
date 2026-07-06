import { type NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { fetchVacantUnits } from "@/lib/appfolio";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  // Auth check — must be an authenticated admin
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // Load enabled properties (appfolio_id → sb property_id mapping)
  const { data: enabledSettings, error: sErr } = await supabase
    .from("appfolio_sync_settings")
    .select("property_id, default_assignee, properties(appfolio_id, name)")
    .eq("sync_enabled", true);
  if (sErr) {
    return NextResponse.json({ error: sErr.message }, { status: 500 });
  }

  type SettingRow = {
    property_id: number;
    default_assignee: string;
    properties: { appfolio_id: string | null; name: string } | null;
  };

  const enabledMap = new Map<string, { sb_property_id: number; property_name: string; default_assignee: string }>();
  for (const row of (enabledSettings ?? []) as unknown as SettingRow[]) {
    if (row.properties?.appfolio_id) {
      enabledMap.set(row.properties.appfolio_id, {
        sb_property_id: row.property_id,
        property_name: row.properties.name,
        default_assignee: row.default_assignee,
      });
    }
  }

  if (enabledMap.size === 0) {
    return NextResponse.json([]);
  }

  // Fetch vacant units from AppFolio
  let vacantUnits;
  try {
    vacantUnits = await fetchVacantUnits();
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AppFolio fetch failed" }, { status: 502 });
  }

  // Filter to enabled properties only
  const relevant = vacantUnits.filter((u) => enabledMap.has(String(u.property_id)));
  if (relevant.length === 0) {
    return NextResponse.json([]);
  }

  // Load active turns for relevant sb_property_ids
  const sbPropertyIds = Array.from(new Set(relevant.map((u) => enabledMap.get(String(u.property_id))!.sb_property_id)));
  const { data: activeTurns } = await supabase
    .from("turns")
    .select("property_id, unit, stage_idx")
    .in("property_id", sbPropertyIds)
    .lt("stage_idx", 5);

  // Build lookup: "property_id:unit" → stage_idx
  const turnLookup = new Map<string, number>();
  for (const t of activeTurns ?? []) {
    turnLookup.set(`${t.property_id}:${t.unit}`, t.stage_idx);
  }

  const result = relevant.map((u) => {
    const mapping = enabledMap.get(String(u.property_id))!;
    const turnKey = `${mapping.sb_property_id}:${u.unit}`;
    const turnStage = turnLookup.get(turnKey);
    return {
      property_id: u.property_id,
      sb_property_id: mapping.sb_property_id,
      property_name: mapping.property_name,
      unit: u.unit,
      unit_id: u.unit_id,
      status: u.status,
      last_move_out: u.last_move_out,
      market_rent: u.market_rent,
      sqft: u.sqft,
      bd_ba: u.bd_ba,
      rent_ready: u.rent_ready,
      has_active_turn: turnStage !== undefined,
      active_turn_stage: turnStage ?? null,
      default_assignee: mapping.default_assignee,
    };
  });

  // Sort: no-turn first, then by property name + unit
  result.sort((a, b) => {
    if (a.has_active_turn !== b.has_active_turn) return a.has_active_turn ? 1 : -1;
    const pc = a.property_name.localeCompare(b.property_name);
    return pc !== 0 ? pc : a.unit.localeCompare(b.unit);
  });

  return NextResponse.json(result);
}
