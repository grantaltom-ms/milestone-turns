import { type NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { fetchRawRentRollSample } from "@/lib/appfolio";

export const dynamic = "force-dynamic";

// TEMPORARY diagnostic route — admin-only. Returns a few raw, unmapped rows
// straight from AppFolio's rent_roll report so we can see every column the
// account's report actually returns (e.g. to find the real "next move-in"
// column name). Delete this route once that's confirmed.
export async function GET(_req: NextRequest) {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const sample = await fetchRawRentRollSample();
    return NextResponse.json({ sample });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AppFolio fetch failed" }, { status: 502 });
  }
}
