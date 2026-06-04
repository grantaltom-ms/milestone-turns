import { getServerSupabase } from "@/lib/supabase/server";

const DEV_FALLBACK_INITIALS = process.env.NEXT_PUBLIC_DEFAULT_USER_INITIALS || "TZ";

export async function getCurrentInitials(): Promise<string> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return DEV_FALLBACK_INITIALS;
  const { data } = await supabase
    .from("app_users")
    .select("initials")
    .eq("user_id", user.id)
    .maybeSingle();
  return data?.initials ?? DEV_FALLBACK_INITIALS;
}
