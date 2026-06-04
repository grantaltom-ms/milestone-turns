"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";

export async function toggleTaskAction(taskId: string, done: boolean) {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("turn_tasks")
    .update({ done })
    .eq("id", taskId)
    .select("turn_id")
    .maybeSingle();
  if (error) throw error;
  if (data?.turn_id) revalidatePath(`/turns/${data.turn_id}`);
  revalidatePath("/");
}

export async function advanceTurnAction(turnId: string) {
  const supabase = await getServerSupabase();
  const { error } = await supabase.rpc("advance_turn", { p_turn_id: turnId });
  if (error) throw error;
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
