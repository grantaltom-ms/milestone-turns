"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";

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
    .select("turn_id")
    .maybeSingle();
  if (error) throw error;
  if (data?.turn_id) revalidatePath(`/turns/${data.turn_id}`);
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
  if (data?.turn_id) revalidatePath(`/turns/${data.turn_id}`);
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

  revalidatePath(`/turns/${turnId}`);
  revalidatePath("/");
}

export async function advanceTurnAction(turnId: string) {
  const supabase = await getServerSupabase();
  const { error } = await supabase.rpc("advance_turn", { p_turn_id: turnId });
  if (error) throw error;
  revalidatePath(`/turns/${turnId}`);
  revalidatePath("/");
}

/** Advance the turn across the office→maintenance boundary and assign the incoming stage. */
export async function handoffToMaintenanceAction(turnId: string, assignee: string) {
  const supabase = await getServerSupabase();
  const { error: advErr } = await supabase.rpc("advance_turn", { p_turn_id: turnId });
  if (advErr) throw advErr;
  const [turnRes, taskRes] = await Promise.all([
    supabase.from("turns").update({ assignee }).eq("id", turnId),
    supabase.from("turn_tasks").update({ assignee }).eq("turn_id", turnId).eq("stage_idx", 2),
  ]);
  if (turnRes.error) throw turnRes.error;
  if (taskRes.error) throw taskRes.error;
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
  const { error } = await supabase.rpc("create_turn", {
    p_property_id: input.property_id,
    p_unit: input.unit,
    p_vacate_date: input.vacate_date,
    p_target_date: input.target_date,
    p_assignee: input.assignee,
  });
  if (error) throw error;
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

export async function bulkCreateTurnsAction(
  rows: BulkRow[],
): Promise<{ created: number; failed: { rowNumber: number; message: string }[] }> {
  const supabase = await getServerSupabase();
  const failed: { rowNumber: number; message: string }[] = [];
  let created = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const { error } = await supabase.rpc("create_turn", {
      p_property_id: r.property_id,
      p_unit: r.unit,
      p_vacate_date: r.vacate_date,
      p_target_date: r.target_date,
      p_assignee: r.assignee,
    });
    if (error) failed.push({ rowNumber: i + 1, message: error.message });
    else created += 1;
  }
  revalidatePath("/");
  return { created, failed };
}

/** Add a note to a task. author_id comes from the current session. */
export async function addTaskNoteAction(input: {
  turn_id: string;
  stage_idx: number;
  task_name: string;
  content: string;
}): Promise<void> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("task_notes").insert({
    turn_id: input.turn_id,
    stage_idx: input.stage_idx,
    task_name: input.task_name,
    author_id: user.id,
    content: input.content.trim(),
  });
  if (error) throw error;

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
  });
  if (error) throw error;
  revalidatePath(`/turns/${turnId}`);
  revalidatePath("/");
}

export async function deleteTaskAction(taskId: string) {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("turn_tasks")
    .delete()
    .eq("id", taskId)
    .select("turn_id")
    .maybeSingle();
  if (error) throw error;
  if (data?.turn_id) revalidatePath(`/turns/${data.turn_id}`);
  revalidatePath("/");
}
