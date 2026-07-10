import { type NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { fetchRawRentRollSample, fetchRawUnitVacancySample } from "@/lib/appfolio";

export const dynamic = "force-dynamic";

// TEMPORARY diagnostic route — admin-only. Returns a few raw, unmapped rows
// straight from an AppFolio report so we can see every column the account's
// report actually returns (e.g. to find the real "next move-in" column
// name). Defaults to unit_vacancy (reportedly has next_move_in); pass
// ?source=rent_roll to check the older report instead. Delete this route
// once the real column is confirmed and the feature is built.
export async function GET(req: NextRequest) {
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

  const source = req.nextUrl.searchParams.get("source") === "rent_roll" ? "rent_roll" : "unit_vacancy";

  try {
    const sample = source === "rent_roll"
      ? await fetchRawRentRollSample()
      : await fetchRawUnitVacancySample();
    return NextResponse.json({ source, sample });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AppFolio fetch failed" }, { status: 502 });
  }
}
