"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-user";
import { logEvent } from "@/lib/events";

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    throw new Error("Admin access required");
  }
  return profile;
}

export async function upsertSyncSettingAction(
  propertyId: number,
  syncEnabled: boolean,
  defaultAssignee: string,
) {
  await requireAdmin();
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("appfolio_sync_settings")
    .upsert(
      { property_id: propertyId, sync_enabled: syncEnabled, default_assignee: defaultAssignee },
      { onConflict: "property_id" },
    );
  if (error) throw error;
  revalidatePath("/admin/appfolio");
}

export async function createTurnFromAppfolioAction(params: {
  propertyId: number;
  unit: string;
  appfolioUnitId: number;
  vacateDate: string;
  targetDate: string;
  assignee: string;
  nextMoveIn?: string | null;
}) {
  const profile = await requireAdmin();
  const supabase = await getServerSupabase();

  // Check for existing active turn for this unit
  const { data: existing } = await supabase
    .from("turns")
    .select("id, stage_idx")
    .eq("property_id", params.propertyId)
    .eq("unit", params.unit)
    .lt("stage_idx", 5)
    .maybeSingle();

  if (existing) {
    throw new Error(`Unit ${params.unit} already has an active turn (stage ${existing.stage_idx})`);
  }

  const { data, error } = await supabase.rpc("create_turn", {
    p_property_id: params.propertyId,
    p_unit: params.unit,
    p_vacate_date: params.vacateDate,
    p_target_date: params.targetDate,
    p_assignee: params.assignee,
  });
  if (error) throw error;

  const turn = Array.isArray(data) ? data[0] : data;
  if (turn?.id) {
    const patch: Record<string, unknown> = { appfolio_unit_id: params.appfolioUnitId };
    if (params.nextMoveIn) patch.next_move_in = params.nextMoveIn;
    await supabase.from("turns").update(patch).eq("id", turn.id);

    await logEvent(turn.id, "created_from_appfolio", profile.initials, {
      unit: params.unit,
      appfolio_unit_id: params.appfolioUnitId,
    });
  }

  revalidatePath("/");
  return turn;
}
