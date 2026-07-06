"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { getCurrentInitials } from "@/lib/current-user";
import { logEvent } from "@/lib/events";

// ─── helpers ──────────────────────────────────────────────────────────────────

async function actor(): Promise<string> {
  try {
    return await getCurrentInitials();
  } catch {
    return "??";
  }
}

/** advance_turn returns the updated turn row (object, or 1-element array). Pull
 * its stage_idx, falling back to `fallback` if the shape is unexpected. */
function rpcStageIdx(data: unknown, fallback: number): number {
  const row = Array.isArray(data) ? data[0] : data;
  const idx = (row as { stage_idx?: number } | null)?.stage_idx;
  return typeof idx === "number" ? idx : fallback;
}

// ─── task actions ─────────────────────────────────────────────────────────────

export async function toggleTaskAction(taskId: string, done: boolean) {
  const supabase = await getServerSupabase();
  // Look up the actor's initials so completed_by is attributable on check.
  const { data: { user } } = await supabase.auth.getUser();
  let actorInitials: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("initials")
      .eq("id", user.id)
      .maybeSingle();
    actorInitials = (profile as { initials?: string } | null)?.initials ?? null;
  }
  const patch = done
    ? { done: true,  done_at: new Date().toISOString(), completed_by: actorInitials }
    : { done: false, done_at: null,                     completed_by: null };
  const { data, error } = await supabase
    .from("turn_tasks")
    .update(patch)
    .eq("id", taskId)
    .select("turn_id, name, stage_idx")
    .maybeSingle();
  if (error) throw error;
  if (data?.turn_id) {
    revalidatePath(`/turns/${data.turn_id}`);
    const me = actorInitials ?? await actor();
    const eventType = done ? "task_completed" : "task_reopened";
    await logEvent(data.turn_id, eventType, me, {
      task_name: data.name,
      stage: data.stage_idx,
    });
  }
  revalidatePath("/");
}

export async function setTaskAssigneeAction(taskId: string, assignee: string) {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("turn_tasks")
    .update({ assignee })
    .eq("id", taskId)
    .select("id, turn_id, name, assignee")
    .maybeSingle();
  if (error) throw error;
  if (data?.turn_id) {
    revalidatePath(`/turns/${data.turn_id}`);
    const me = await actor();
    await logEvent(data.turn_id, "task_assigned", me, {
      task_name: data.name,
      assignee: data.assignee,
    });
  }
  revalidatePath("/");

  if (data) {
    const { notifyTaskAssigned } = await import("@/lib/slack");
    await notifyTaskAssigned({ taskId: data.id, taskName: data.name, turnId: data.turn_id, assignee: data.assignee });
  }
}

/** Assign a whole stage to one person — updates turn.assignee and all its tasks. */
export async function setStageAssigneeAction(turnId: string, assignee: string) {
  const supabase = await getServerSupabase();

  const [turnRes, tasksRes] = await Promise.all([
    supabase.from("turns").update({ assignee }).eq("id", turnId),
    supabase.from("turn_tasks").update({ assignee }).eq("turn_id", turnId),
  ]);
  if (turnRes.error) throw turnRes.error;
  if (tasksRes.error) throw tasksRes.error;

  const me = await actor();
  await logEvent(turnId, "assigned", me, { assignee });

  revalidatePath(`/turns/${turnId}`);
  revalidatePath("/");
}

export async function advanceTurnAction(turnId: string) {
  const supabase = await getServerSupabase();
  // Capture the current stage BEFORE advancing so we can log from→to
  const { data: before } = await supabase
    .from("turns")
    .select("stage_idx")
    .eq("id", turnId)
    .maybeSingle();
  const fromStage = (before as { stage_idx: number } | null)?.stage_idx ?? 0;

  const { data, error } = await supabase.rpc("advance_turn", { p_turn_id: turnId });
  if (error) throw error;
  // advance_turn may auto-jump skipped phases, so read the real landing stage.
  const landed = rpcStageIdx(data, fromStage + 1);

  const me = await actor();
  await logEvent(turnId, "advanced", me, {
    from_stage: fromStage,
    to_stage: landed,
  });

  revalidatePath(`/turns/${turnId}`);
  revalidatePath("/");
}

/** Advance the turn across the office→maintenance boundary and assign the incoming stage. */
export async function handoffToMaintenanceAction(turnId: string, assignee: string) {
  const supabase = await getServerSupabase();
  // Capture current stage before advancing
  const { data: before } = await supabase
    .from("turns")
    .select("stage_idx")
    .eq("id", turnId)
    .maybeSingle();
  const fromStage = (before as { stage_idx: number } | null)?.stage_idx ?? 1;

  const { data, error: advErr } = await supabase.rpc("advance_turn", { p_turn_id: turnId });
  if (advErr) throw advErr;
  // Assign the stage we actually landed on (advance may auto-jump skipped phases).
  const landed = rpcStageIdx(data, fromStage + 1);
  const [turnRes, taskRes] = await Promise.all([
    supabase.from("turns").update({ assignee }).eq("id", turnId),
    supabase.from("turn_tasks").update({ assignee }).eq("turn_id", turnId).eq("stage_idx", landed),
  ]);
  if (turnRes.error) throw turnRes.error;
  if (taskRes.error) throw taskRes.error;

  const me = await actor();
  await logEvent(turnId, "handed_off", me, {
    from_stage: fromStage,
    to_stage: landed,
    assigned_to: assignee,
  });

  revalidatePath(`/turns/${turnId}`);
  revalidatePath("/");
}

export async function createTurnAction(input: {
  property_id: number;
  unit: string;
  vacate_date: string;
  target_date: string;
  assignee: string;
}) {
  const supabase = await getServerSupabase();
  // create_turn RPC returns the new turn id
  const { data: newTurnId, error } = await supabase.rpc("create_turn", {
    p_property_id: input.property_id,
    p_unit: input.unit,
    p_vacate_date: input.vacate_date,
    p_target_date: input.target_date,
    p_assignee: input.assignee,
  });
  if (error) throw error;

  if (newTurnId) {
    const me = await actor();
    await logEvent(newTurnId as string, "created", me);
  }

  revalidatePath("/");
  redirect("/");
}

export type BulkRow = {
  property_id: number;
  unit: string;
  vacate_date: string;
  target_date: string;
  assignee: string;
};

export type BulkImportResult = {
  created: number;
  skipped: number;
  errors: string[];
};

export async function bulkCreateTurnsAction(
  rows: BulkRow[],
): Promise<BulkImportResult> {
  const supabase = await getServerSupabase();
  const me = await actor();

  const { data, error } = await supabase.rpc("bulk_create_turns", { p_rows: rows });
  if (error) throw error;

  type RpcRow = { unit: string; status: string; turn_id?: string; reason?: string };
  const results = (data as RpcRow[]) ?? [];

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const r of results) {
    if (r.status === "created") {
      created++;
      if (r.turn_id) await logEvent(r.turn_id, "created", me);
    } else if (r.status === "skipped") {
      skipped++;
    } else {
      errors.push(`${r.unit}: ${r.reason ?? "unknown error"}`);
    }
  }

  revalidatePath("/");
  return { created, skipped, errors };
}

/** Add a note (text and/or photo) to a task. author_id comes from the current session. */
export async function addTaskNoteAction(input: {
  turn_id: string;
  stage_idx: number;
  task_name: string;
  content?: string;
  photo_url?: string;
}): Promise<void> {
  if (!input.content?.trim() && !input.photo_url) throw new Error("Note must have text or a photo");

  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("task_notes").insert({
    turn_id: input.turn_id,
    stage_idx: input.stage_idx,
    task_name: input.task_name,
    author_id: user.id,
    content: input.content?.trim() ?? null,
    photo_url: input.photo_url ?? null,
  });
  if (error) throw error;

  const me = await actor();
  await logEvent(input.turn_id, "note_added", me, { task_name: input.task_name });

  revalidatePath(`/turns/${input.turn_id}`);
}

/** Upsert a user's own profile (called from onboarding). */
export async function upsertProfileAction(input: {
  name: string;
}): Promise<void> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Compute initials: first char of first + last word of name
  const parts = input.name.trim().split(/\s+/);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase();

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    name: input.name.trim(),
    email: user.email ?? "",
    initials,
    // role + avatar_color keep their DB defaults on first insert;
    // admin can update directly in Supabase
  }, { onConflict: "id" });
  if (error) throw error;

  revalidatePath("/");
}

/** Sign the current user out. */
export async function signOutAction(): Promise<void> {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updateTurnAction(turnId: string, patch: {
  unit?: string;
  vacate_date?: string;
  target_date?: string;
}) {
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("turns").update(patch).eq("id", turnId);
  if (error) throw error;

  const me = await actor();
  const fieldsChanged = Object.keys(patch).filter((k) => patch[k as keyof typeof patch] !== undefined);
  await logEvent(turnId, "edited", me, { fields_changed: fieldsChanged });

  revalidatePath(`/turns/${turnId}`);
  revalidatePath("/");
}

export async function deleteTurnAction(turnId: string) {
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("turns").delete().eq("id", turnId);
  if (error) throw error;
  revalidatePath("/");
  redirect("/");
}

export async function addTaskAction(turnId: string, stageIdx: number, name: string) {
  const supabase = await getServerSupabase();
  const [{ data: maxTask }, { data: turn }] = await Promise.all([
    supabase
      .from("turn_tasks")
      .select("sort_order")
      .eq("turn_id", turnId)
      .eq("stage_idx", stageIdx)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("turns").select("assignee").eq("id", turnId).maybeSingle(),
  ]);
  const sortOrder = ((maxTask as { sort_order: number } | null)?.sort_order ?? -1) + 1;
  const assignee = (turn as { assignee: string } | null)?.assignee ?? "";
  const { error } = await supabase.from("turn_tasks").insert({
    turn_id: turnId,
    stage_idx: stageIdx,
    name: name.trim(),
    assignee,
    done: false,
    sort_order: sortOrder,
    is_custom: true, // one-off task added on this specific turn
  });
  if (error) throw error;

  const me = await actor();
  await logEvent(turnId, "task_added", me, { task_name: name.trim(), stage: stageIdx });

  revalidatePath(`/turns/${turnId}`);
  revalidatePath("/");
}

/**
 * Remove a task from a turn. Custom (one-off) tasks are hard-deleted; default
 * tasks are soft-removed (kept in the row, flagged `removed`) so the underlying
 * template in stage_default_tasks is never touched.
 */
export async function deleteTaskAction(taskId: string) {
  const supabase = await getServerSupabase();
  const { data: existing, error: lookupErr } = await supabase
    .from("turn_tasks")
    .select("turn_id, name, stage_idx, is_custom")
    .eq("id", taskId)
    .maybeSingle();
  if (lookupErr) throw lookupErr;
  const task = existing as { turn_id: string; name: string; stage_idx: number; is_custom: boolean } | null;
  if (!task) return;

  if (task.is_custom) {
    const { error } = await supabase.from("turn_tasks").delete().eq("id", taskId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("turn_tasks").update({ removed: true }).eq("id", taskId);
    if (error) throw error;
  }

  const me = await actor();
  await logEvent(task.turn_id, "task_removed", me, { task_name: task.name, stage: task.stage_idx });

  revalidatePath(`/turns/${task.turn_id}`);
  revalidatePath("/");
}

/** Skip or un-skip a phase on a turn. Any authenticated user with turn access. */
export async function togglePhaseSkipAction(turnId: string, stageIdx: number, skip: boolean) {
  const supabase = await getServerSupabase();
  const { data: turn, error: readErr } = await supabase
    .from("turns")
    .select("skipped_phases")
    .eq("id", turnId)
    .maybeSingle();
  if (readErr) throw readErr;

  const current = new Set<number>(((turn as { skipped_phases: number[] } | null)?.skipped_phases) ?? []);
  if (skip) current.add(stageIdx);
  else current.delete(stageIdx);

  const { error } = await supabase
    .from("turns")
    .update({ skipped_phases: Array.from(current).sort((a, b) => a - b) })
    .eq("id", turnId);
  if (error) throw error;

  const me = await actor();
  await logEvent(turnId, skip ? "phase_skipped" : "phase_unskipped", me, { stage: stageIdx });

  revalidatePath(`/turns/${turnId}`);
  revalidatePath("/");
}

export async function putTurnOnHoldAction(
  turnId: string,
  holdStatus: "on_hold" | "blocked",
  holdReason: string,
) {
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("turns")
    .update({
      hold_status: holdStatus,
      hold_reason: holdReason.trim(),
      held_at: new Date().toISOString(),
    })
    .eq("id", turnId);
  if (error) throw error;

  const me = await actor();
  await logEvent(turnId, "held", me, { hold_status: holdStatus, reason: holdReason.trim() });

  revalidatePath(`/turns/${turnId}`);
  revalidatePath("/");
}

export async function resumeTurnAction(turnId: string) {
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("turns")
    .update({ hold_status: null, hold_reason: null, held_at: null })
    .eq("id", turnId);
  if (error) throw error;

  const me = await actor();
  await logEvent(turnId, "resumed", me);

  revalidatePath(`/turns/${turnId}`);
  revalidatePath("/");
}

export async function revertTurnAction(turnId: string, reason: string) {
  const supabase = await getServerSupabase();
  const { error } = await supabase.rpc("revert_turn", { p_turn_id: turnId, p_reason: reason });
  if (error) throw error;

  const me = await actor();
  await logEvent(turnId, "reverted", me, { reason });

  revalidatePath(`/turns/${turnId}`);
  revalidatePath("/");
}
