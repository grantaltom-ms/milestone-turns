import { type NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Supabase magic-link callback.
 * The email link redirects here with ?code=... (PKCE flow).
 * We exchange the code for a session and then redirect to the
 * destination (or /onboarding if this is the user's first login).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth callback error:", error.message);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // Check if the user has a profile yet
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      // First login — send to onboarding; preserve the original destination
      const onboardUrl = new URL("/onboarding", origin);
      if (next !== "/") onboardUrl.searchParams.set("next", next);
      return NextResponse.redirect(onboardUrl.toString());
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
