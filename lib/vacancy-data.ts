import { getServiceSupabase } from "@/lib/supabase/service";
import type { VacancySnapshotRow } from "@/lib/vacancy-board";

const COLUMNS =
  "property_id, property_name, unit, unit_status, bed_bath, sqft, last_move_out, available_on, next_move_in, city";

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

  const [{ data, error }, { data: properties, error: pErr }] = await Promise.all([
    supabase.from("unit_vacancy_snapshots").select(COLUMNS).eq("snapshot_date", snapshotDate),
    // The board groups buildings into service areas by city. `properties.city`
    // is the authoritative copy: the snapshot's own city column is filled by
    // the CSV upload path but not necessarily by the nightly API sync, so
    // relying on it alone would empty the board the day uploads stop.
    supabase.from("properties").select("id, city"),
  ]);
  if (error) throw error;
  if (pErr) throw pErr;

  const cityById = new Map<number, string | null>();
  for (const p of (properties ?? []) as { id: number; city: string | null }[]) {
    cityById.set(p.id, p.city);
  }

  type RawRow = VacancySnapshotRow & { property_id: number | null };
  const rows = ((data ?? []) as RawRow[]).map((r) => ({
    ...r,
    // Fall back to the snapshot's own city for a row whose building could not
    // be resolved to a properties row.
    city: (r.property_id != null ? cityById.get(r.property_id) : null) ?? r.city ?? null,
  }));

  return { snapshotDate, rows };
}
