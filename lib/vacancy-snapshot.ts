/**
 * Shaping logic for the nightly `unit_vacancy_snapshots` write.
 *
 * Kept pure (no Supabase, no fetch) so the property resolution and column
 * mapping can be unit-tested directly — those are where the sharp edges are.
 */
import type { AppfolioVacantUnit } from "@/lib/appfolio";

/** A building as Supabase knows it, used to resolve AppFolio's own ids. */
export type PropertyRef = {
  id: number;
  name: string;
  appfolio_id: string | null;
};

/** One row destined for `unit_vacancy_snapshots`. */
export type SnapshotRow = {
  snapshot_date: string;
  property_id: number | null;
  property_name: string;
  unit: string;
  bed_bath: string | null;
  sqft: number | null;
  unit_status: string;
  last_move_out: string | null;
  available_on: string | null;
  next_move_in: string | null;
  description: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  source_file: string;
};

export type SnapshotBuild = {
  rows: SnapshotRow[];
  /** AppFolio buildings with no match in `properties` — they still get rows
   *  (property_id is nullable), but drop out of the manager-joined views. */
  unresolved: string[];
};

/** Marks cron-written rows apart from the hand-uploaded CSV snapshots. */
export const SNAPSHOT_SOURCE = "appfolio_api:unit_vacancy";

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Map AppFolio's vacancy rows onto snapshot rows.
 *
 * `unit_vacancy_snapshots.property_id` holds the **Supabase** properties.id,
 * not AppFolio's — the CSV upload path resolves it the same way, and the
 * manager-facing views join on it. Resolution prefers the explicit
 * `appfolio_id` mapping and falls back to an exact (case-insensitive) name
 * match, which is how those ids were seeded in the first place.
 *
 * The building's Supabase name wins over AppFolio's when it resolves: the
 * table's natural key is (snapshot_date, property_name, unit), so letting a
 * name drift through would create a second row for the same building rather
 * than updating the existing one.
 */
export function buildSnapshotRows(
  units: AppfolioVacantUnit[],
  properties: PropertyRef[],
  snapshotDate: string,
  source: string = SNAPSHOT_SOURCE,
): SnapshotBuild {
  const byAppfolioId = new Map<string, PropertyRef>();
  const byName = new Map<string, PropertyRef>();
  for (const p of properties) {
    if (p.appfolio_id) byAppfolioId.set(p.appfolio_id, p);
    byName.set(normalizeName(p.name), p);
  }

  const rows: SnapshotRow[] = [];
  const unresolved = new Set<string>();
  // The natural key allows one row per building+unit per day; AppFolio
  // returning a duplicate would otherwise make the whole upsert fail.
  const seen = new Set<string>();

  for (const u of units) {
    const appfolioName = (u.property_name ?? "").trim();
    const match =
      byAppfolioId.get(String(u.property_id)) ?? byName.get(normalizeName(appfolioName));

    if (!match && appfolioName) unresolved.add(appfolioName);

    const propertyName = match?.name ?? appfolioName;
    const unit = (u.unit ?? "").trim();
    if (!propertyName || !unit) continue; // both are NOT NULL in the table

    const key = `${propertyName} ${unit}`;
    if (seen.has(key)) continue;
    seen.add(key);

    rows.push({
      snapshot_date: snapshotDate,
      property_id: match?.id ?? null,
      property_name: propertyName,
      unit,
      bed_bath: u.bd_ba ?? null,
      sqft: u.sqft ?? null,
      unit_status: u.status,
      last_move_out: u.last_move_out ?? null,
      available_on: u.available_on ?? null,
      next_move_in: u.next_move_in ?? null,
      // Best-effort listing detail; null unless the report supplies it.
      description: u.description ?? null,
      street_address: u.street_address ?? null,
      city: u.city ?? null,
      state: u.state ?? null,
      zip: u.zip ?? null,
      source_file: source,
    });
  }

  return { rows, unresolved: Array.from(unresolved).sort() };
}
