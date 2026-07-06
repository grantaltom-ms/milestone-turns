"use server";

import { createClient } from "@supabase/supabase-js";

export type PublicProfile = { id: string; name: string; initials: string };

/** Load the team roster for the login dropdown. No auth required. */
export async function loadPublicProfilesAction(): Promise<PublicProfile[]> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data } = await admin
    .from("profiles")
    .select("id, name, initials")
    .order("name");
  return (data ?? []) as PublicProfile[];
}

/** Generate a one-time login token for the selected profile.
 *  Returns { email, token } — the client calls verifyOtp to establish a session. */
export async function loginAsUserAction(
  profileId: string,
): Promise<{ token_hash: string }> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", profileId)
    .maybeSingle();

  if (!(profile as { email?: string } | null)?.email) {
    throw new Error("Profile not found");
  }
  const email = (profile as { email: string }).email;

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (error) throw new Error(error.message);

  return { token_hash: data.properties.hashed_token };
}
