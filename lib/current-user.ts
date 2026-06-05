import { getServerSupabase } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

const REQUIRE_AUTH = process.env.NEXT_PUBLIC_REQUIRE_AUTH === "true";

const DEV_PROFILE: Profile = {
  id: "00000000-0000-0000-0000-000000000000",
  name: "Preview",
  email: "preview@local",
  role: "office_lead",
  initials: process.env.NEXT_PUBLIC_DEFAULT_USER_INITIALS ?? "DEV",
  avatar_color: "#2E6B5E",
  created_at: new Date(0).toISOString(),
};

/** Returns the full profile of the signed-in user, or null if not auth'd / no profile yet. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return REQUIRE_AUTH ? null : DEV_PROFILE;
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
