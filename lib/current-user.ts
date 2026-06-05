import { getServerSupabase } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

/** Returns the full profile of the signed-in user, or null if not auth'd / no profile yet. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, name, email, role, initials, avatar_color, created_at")
    .eq("id", user.id)
    .maybeSingle();
  return data as Profile | null;
}

/** Returns just the initials for places that only need that. */
export async function getCurrentInitials(): Promise<string> {
  const profile = await getCurrentProfile();
  return profile?.initials ?? "?";
}
