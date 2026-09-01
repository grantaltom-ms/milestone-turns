/**
 * Fixture rows for the vacancy-board end-to-end test, shared by the mock
 * Supabase server and the spec so both agree on the expected numbers.
 *
 * Dates are expressed as offsets from today so the day counts the board
 * renders are stable no matter when the suite runs.
 */

export type FixtureRow = {
  property_name: string | null;
  unit: string | null;
  unit_status: string;
  bed_bath: string | null;
  sqft: number | null;
  last_move_out: string | null;
  available_on: string | null;
  next_move_in: string | null;
};

/** Today in Seattle as YYYY-MM-DD — matches the board's own clock. */
export function today(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function shiftDays(iso: string, days: number): string {
  const ms = Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

export const SNAPSHOT_DATE = today();

const ago = (n: number) => shiftDays(SNAPSHOT_DATE, -n);
const ahead = (n: number) => shiftDays(SNAPSHOT_DATE, n);

/** Expected day counts, keyed "Building:unit" — asserted directly in the spec. */
export const EXPECTED_DAYS_VACANT: Record<string, number> = {
  "Ascona:105": 62,
  "Ascona:202": 12,
  "Ascona:41": 3,
  "Bel Vista:2": 44,
  "Crosby:7": 31,
  "Crosby:10": 5,
  "Woodland:3": 1,
};

export const EXPECTED_DAYS_UNTIL_OUT: Record<string, number> = {
  "DD Culp:220": 6,
  "DD Culp:116": 29,
  "Envoy:106": 14,
  "Kerry Park:A": 45,
};

export const FIXTURE_ROWS: FixtureRow[] = [
  // ── Vacant now ────────────────────────────────────────────────────────────
  { property_name: "Ascona", unit: "105", unit_status: "Vacant-Unrented", bed_bath: "0/1.00", sqft: 327, last_move_out: ago(62), available_on: null, next_move_in: null },
  { property_name: "Ascona", unit: "202", unit_status: "Vacant-Rented", bed_bath: "1/1.00", sqft: 315, last_move_out: ago(12), available_on: null, next_move_in: ahead(9) },
  { property_name: "Ascona", unit: "41", unit_status: "Vacant-Unrented", bed_bath: "2/1.50", sqft: 880, last_move_out: ago(3), available_on: null, next_move_in: null },
  { property_name: "Bel Vista", unit: "2", unit_status: "Vacant-Unrented", bed_bath: "0/1.00", sqft: 435, last_move_out: ago(44), available_on: null, next_move_in: null },
  { property_name: "Crosby", unit: "7", unit_status: "Vacant-Unrented", bed_bath: "1/1.00", sqft: 600, last_move_out: ago(31), available_on: null, next_move_in: null },
  { property_name: "Crosby", unit: "10", unit_status: "Vacant-Unrented", bed_bath: "1/1.00", sqft: 610, last_move_out: ago(5), available_on: null, next_move_in: null },
  { property_name: "Woodland", unit: "3", unit_status: "Vacant-Unrented", bed_bath: "1/1.00", sqft: 540, last_move_out: ago(1), available_on: null, next_move_in: null },
  // Missing move-out date — the board must still list it rather than drop it.
  { property_name: "Woodland", unit: "9", unit_status: "Vacant-Unrented", bed_bath: null, sqft: null, last_move_out: null, available_on: null, next_move_in: null },

  // ── On notice ─────────────────────────────────────────────────────────────
  { property_name: "DD Culp", unit: "220", unit_status: "Notice-Unrented", bed_bath: "1/1.00", sqft: 693, last_move_out: ahead(6), available_on: ahead(16), next_move_in: null },
  { property_name: "DD Culp", unit: "116", unit_status: "Notice-Unrented", bed_bath: "0/1.00", sqft: 485, last_move_out: ahead(29), available_on: ahead(39), next_move_in: null },
  { property_name: "Envoy", unit: "106", unit_status: "Notice-Rented", bed_bath: "0/1.00", sqft: 381, last_move_out: ahead(14), available_on: ahead(24), next_move_in: null },
  { property_name: "Kerry Park", unit: "A", unit_status: "Notice-Unrented", bed_bath: "0/1.00", sqft: 379, last_move_out: ahead(45), available_on: ahead(55), next_move_in: null },

  // ── Occupied — must appear on neither tab ─────────────────────────────────
  { property_name: "Ascona", unit: "300", unit_status: "Occupied", bed_bath: "1/1.00", sqft: 400, last_move_out: ago(400), available_on: null, next_move_in: null },
  { property_name: "Crosby", unit: "12", unit_status: "Occupied", bed_bath: "1/1.00", sqft: 600, last_move_out: null, available_on: null, next_move_in: null },
];

export const VACANT_COUNT = FIXTURE_ROWS.filter((r) => r.unit_status.startsWith("Vacant")).length;
export const UPCOMING_COUNT = FIXTURE_ROWS.filter((r) => r.unit_status.startsWith("Notice")).length;

/** An older snapshot the board must ignore in favour of the newest one. */
export const STALE_SNAPSHOT_DATE = shiftDays(SNAPSHOT_DATE, -1);
export const STALE_ROWS: FixtureRow[] = [
  { property_name: "Should Not Appear", unit: "999", unit_status: "Vacant-Unrented", bed_bath: "1/1.00", sqft: 100, last_move_out: ago(500), available_on: null, next_move_in: null },
];
