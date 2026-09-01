import { getServiceSupabase } from "@/lib/supabase/service";
import type { VacancySnapshotRow } from "@/lib/vacancy-board";

const COLUMNS =
  "property_name, unit, unit_status, bed_bath, sqft, last_move_out, available_on, next_move_in";

export type VacancySnapshot = {
  /** Date of the newest snapshot, or null when the table is empty. */
  snapshotDate: string | null;
  rows: VacancySnapshotRow[];
};

/**
 * The most recent day's AppFolio unit-vacancy snapshot.
 *
 * Reads with the service key because `unit_vacancy_snapshots` has RLS on with
 * no policies — nothing is readable through the anon/authenticated roles, and
 * the vacancy board is served to a link holder who has no Supabase session.
 */
export async function loadLatestVacancySnapshot(): Promise<VacancySnapshot> {
  const supabase = getServiceSupabase();

  const { data: latest, error: latestErr } = await supabase
    .from("unit_vacancy_snapshots")
    .select("snapshot_date")
    .order("snapshot_date", { ascending: false })
    .limit(1);
  if (latestErr) throw latestErr;

  const snapshotDate = (latest as { snapshot_date: string }[] | null)?.[0]?.snapshot_date ?? null;
  if (!snapshotDate) return { snapshotDate: null, rows: [] };

  const { data, error } = await supabase
    .from("unit_vacancy_snapshots")
    .select(COLUMNS)
    .eq("snapshot_date", snapshotDate);
  if (error) throw error;

  return { snapshotDate, rows: (data ?? []) as VacancySnapshotRow[] };
}
