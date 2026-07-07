"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// ─── admin guard ────────────────────────────────────────────────────────────
// Defense in depth: RLS (migration 0011) already blocks non-admin writes, but
// we fail fast here too so a non-admin gets a clear error rather than a silent
// RLS no-op.
async function requireAdmin(): Promise<SupabaseClient> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    throw new Error("Forbidden: admin only");
  }
  return supabase;
}

// ─── reorder phases (admin UI display order only) ───────────────────────────
// Writes display_order on admin_stage_config. Does NOT touch stage_idx, so no
// turn/turn_task data is affected — this only changes how phases are listed in
// the admin UI. No unique constraint on display_order, so a single pass is safe.
export async function reorderStagesAction(
  stages: { stage_idx: number; display_order: number }[],
) {
  const supabase = await requireAdmin();
  for (const s of stages) {
    const { error } = await supabase
      .from("admin_stage_config")
      .update({ display_order: s.display_order })
      .eq("stage_idx", s.stage_idx);
    if (error) throw error;
  }
  revalidatePath("/admin");
}

// ─── reorder default tasks within a stage ───────────────────────────────────
// `tasks` is the full set of rows for ONE stage, in the desired final order.
// The unique index on (stage_idx, sort_order) means we can't move rows straight
// to their final slots — an intermediate state would collide. So we do two
// passes: first park every row in a high, collision-free band (1000+), then
// write the real 0..n-1 values.
export async function reorderTasksInStageAction(
  tasks: { id: number; sort_order: number }[],
) {
  const supabase = await requireAdmin();

  // Pass 1: park out of the way.
  for (let i = 0; i < tasks.length; i++) {
    const { error } = await supabase
      .from("stage_default_tasks")
      .update({ sort_order: 1000 + i })
      .eq("id", tasks[i].id);
    if (error) throw error;
  }
  // Pass 2: write final positions.
  for (const t of tasks) {
    const { error } = await supabase
      .from("stage_default_tasks")
      .update({ sort_order: t.sort_order })
      .eq("id", t.id);
    if (error) throw error;
  }

  revalidatePath("/admin");
  // New Turn auto-fill reads the same table — keep it fresh too.
  revalidatePath("/turns/new");
}

// ─── add a default task to a stage ──────────────────────────────────────────
export async function addDefaultTaskAction(stageIdx: number, taskName: string) {
  const name = taskName.trim();
  if (!name) throw new Error("Task name required");
  const supabase = await requireAdmin();

  // Next sort_order = (current max for this stage) + 1.
  const { data: rows, error: maxErr } = await supabase
    .from("stage_default_tasks")
    .select("sort_order")
    .eq("stage_idx", stageIdx)
    .order("sort_order", { ascending: false })
    .limit(1);
  if (maxErr) throw maxErr;
  const nextOrder = ((rows?.[0] as { sort_order?: number } | undefined)?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("stage_default_tasks")
    .insert({ stage_idx: stageIdx, name, sort_order: nextOrder })
    .select("id, stage_idx, name, sort_order")
    .single();
  if (error) throw error;

  revalidatePath("/admin");
  revalidatePath("/turns/new");
  return data as { id: number; stage_idx: number; name: string; sort_order: number };
}

// ─── delete a default task ──────────────────────────────────────────────────
// Leaves a gap in sort_order; ordering still works, so no renumber needed.
export async function deleteDefaultTaskAction(id: number) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("stage_default_tasks")
    .delete()
    .eq("id", id);
  if (error) throw error;

  revalidatePath("/admin");
  revalidatePath("/turns/new");
}

// ─── task templates (per phase) ─────────────────────────────────────────────
export type TemplateItem = { name: string; sort_order: number };
export type SavedTemplate = { id: number; stage_idx: number; name: string; items: TemplateItem[] };

// Save the phase's current default tasks as a named template. If a template
// with this (stage_idx, name) already exists, its items are replaced so "save"
// updates rather than erroring on the unique constraint.
export async function saveTemplateAction(stageIdx: number, templateName: string): Promise<SavedTemplate> {
  const name = templateName.trim();
  if (!name) throw new Error("Template name required");
  const supabase = await requireAdmin();

  // Snapshot the phase's current defaults, in order.
  const { data: defaults, error: defErr } = await supabase
    .from("stage_default_tasks")
    .select("name, sort_order")
    .eq("stage_idx", stageIdx)
    .order("sort_order", { ascending: true });
  if (defErr) throw defErr;
  const items: TemplateItem[] = (defaults ?? []).map((d, i) => ({
    name: (d as { name: string }).name,
    sort_order: i, // renumber 0..n-1 so gaps from deletes don't carry over
  }));

  // Upsert the template row, then replace its items.
  const { data: existing, error: findErr } = await supabase
    .from("stage_task_templates")
    .select("id")
    .eq("stage_idx", stageIdx)
    .eq("name", name)
    .maybeSingle();
  if (findErr) throw findErr;

  let templateId = (existing as { id?: number } | null)?.id;
  if (templateId === undefined) {
    const { data: created, error: insErr } = await supabase
      .from("stage_task_templates")
      .insert({ stage_idx: stageIdx, name })
      .select("id")
      .single();
    if (insErr) throw insErr;
    templateId = (created as { id: number }).id;
  } else {
    const { error: clearErr } = await supabase
      .from("stage_task_template_items")
      .delete()
      .eq("template_id", templateId);
    if (clearErr) throw clearErr;
  }

  if (items.length > 0) {
    const { error: itemsErr } = await supabase
      .from("stage_task_template_items")
      .insert(items.map((it) => ({ template_id: templateId, name: it.name, sort_order: it.sort_order })));
    if (itemsErr) throw itemsErr;
  }

  revalidatePath("/admin");
  return { id: templateId!, stage_idx: stageIdx, name, items };
}

// Load a template into a phase: REPLACE that phase's default tasks with the
// template's items. Delete-then-insert keeps the unique (stage_idx, sort_order)
// index collision-free. Returns the new default-task rows for optimistic UI.
export async function loadTemplateAction(
  stageIdx: number,
  templateId: number,
): Promise<{ id: number; stage_idx: number; name: string; sort_order: number }[]> {
  const supabase = await requireAdmin();

  const { data: items, error: itemsErr } = await supabase
    .from("stage_task_template_items")
    .select("name, sort_order")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: true });
  if (itemsErr) throw itemsErr;

  const { error: delErr } = await supabase
    .from("stage_default_tasks")
    .delete()
    .eq("stage_idx", stageIdx);
  if (delErr) throw delErr;

  const rows = (items ?? []).map((it, i) => ({
    stage_idx: stageIdx,
    name: (it as { name: string }).name,
    sort_order: i,
  }));
  if (rows.length === 0) {
    revalidatePath("/admin");
    revalidatePath("/turns/new");
    return [];
  }

  const { data: inserted, error: insErr } = await supabase
    .from("stage_default_tasks")
    .insert(rows)
    .select("id, stage_idx, name, sort_order")
    .order("sort_order", { ascending: true });
  if (insErr) throw insErr;

  revalidatePath("/admin");
  revalidatePath("/turns/new");
  return (inserted ?? []) as { id: number; stage_idx: number; name: string; sort_order: number }[];
}

// Delete a saved template (items cascade via FK).
export async function deleteTemplateAction(templateId: number) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("stage_task_templates")
    .delete()
    .eq("id", templateId);
  if (error) throw error;

  revalidatePath("/admin");
}
