"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

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

/** Link (or unlink, with an empty string) a teammate's Slack member ID so
 * task/handoff/hold notifications DM them directly instead of falling back
 * to the shared channel. */
export async function setUserSlackIdAction(profileId: string, slackUserId: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("profiles")
    .update({ slack_user_id: slackUserId.trim() || null })
    .eq("id", profileId);
  if (error) throw error;

  revalidatePath("/admin/notifications");
}
