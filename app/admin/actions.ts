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
