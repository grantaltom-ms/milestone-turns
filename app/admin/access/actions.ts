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

/** Replace a user's building assignments. An empty list clears the restriction
 *  (the user then sees all buildings). */
export async function setUserBuildingsAction(profileId: string, propertyIds: number[]) {
  const supabase = await requireAdmin();

  const { error: delErr } = await supabase
    .from("user_building_access")
    .delete()
    .eq("profile_id", profileId);
  if (delErr) throw delErr;

  if (propertyIds.length > 0) {
    const rows = propertyIds.map((pid) => ({ profile_id: profileId, property_id: pid }));
    const { error: insErr } = await supabase.from("user_building_access").insert(rows);
    if (insErr) throw insErr;
  }

  revalidatePath("/admin/access");
  revalidatePath("/");
  revalidatePath("/my-tasks");
}
