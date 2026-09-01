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
  property_id: number | null;
};

/** `properties` rows the board joins for each building's service-area city. */
export const BOARD_PROPERTY_ROWS = [
  { id: 1, name: "Alder Court", city: "Seattle" },
  { id: 2, name: "Ascona", city: "Seattle" },
  { id: 3, name: "Bel Vista", city: "Renton" },   // Renton is worked as Seattle
  { id: 4, name: "Crosby", city: "Burien" },
  { id: 5, name: "DD Culp", city: "Seattle" },
  { id: 6, name: "Envoy", city: "Des Moines" },   // Des Moines is worked as SeaTac
  { id: 7, name: "Kerry Park", city: "Bellevue" }, // Eastside
  { id: 8, name: "Far Away Place", city: "San Francisco" }, // out of area
];

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
  "Alder Court:3": 1,
};

export const EXPECTED_DAYS_UNTIL_OUT: Record<string, number> = {
  "DD Culp:220": 34,
  "DD Culp:116": 29,
  "Envoy:106": 14,
  "Kerry Park:A": 6,
};

export const FIXTURE_ROWS: FixtureRow[] = [
  // ── Vacant now ────────────────────────────────────────────────────────────
  { property_name: "Ascona", unit: "105", unit_status: "Vacant-Unrented", bed_bath: "0/1.00", sqft: 327, last_move_out: ago(62), available_on: null, next_move_in: null , property_id: 2 },
  { property_name: "Ascona", unit: "202", unit_status: "Vacant-Rented", bed_bath: "1/1.00", sqft: 315, last_move_out: ago(12), available_on: null, next_move_in: ahead(9) , property_id: 2 },
  { property_name: "Ascona", unit: "41", unit_status: "Vacant-Unrented", bed_bath: "2/1.50", sqft: 880, last_move_out: ago(3), available_on: null, next_move_in: null , property_id: 2 },
  { property_name: "Bel Vista", unit: "2", unit_status: "Vacant-Unrented", bed_bath: "0/1.00", sqft: 435, last_move_out: ago(44), available_on: null, next_move_in: null , property_id: 3 },
  { property_name: "Crosby", unit: "7", unit_status: "Vacant-Unrented", bed_bath: "1/1.00", sqft: 600, last_move_out: ago(31), available_on: null, next_move_in: null , property_id: 4 },
  { property_name: "Crosby", unit: "10", unit_status: "Vacant-Unrented", bed_bath: "1/1.00", sqft: 610, last_move_out: ago(5), available_on: null, next_move_in: null , property_id: 4 },
  { property_name: "Alder Court", unit: "3", unit_status: "Vacant-Unrented", bed_bath: "1/1.00", sqft: 540, last_move_out: ago(1), available_on: null, next_move_in: null , property_id: 1 },
  // Missing move-out date — the board must still list it rather than drop it.
  { property_name: "Alder Court", unit: "9", unit_status: "Vacant-Unrented", bed_bath: null, sqft: null, last_move_out: null, available_on: null, next_move_in: null , property_id: 1 },

  // ── On notice ─────────────────────────────────────────────────────────────
  { property_name: "DD Culp", unit: "220", unit_status: "Notice-Unrented", bed_bath: "1/1.00", sqft: 693, last_move_out: ahead(34), available_on: ahead(44), next_move_in: null , property_id: 5 },
  { property_name: "DD Culp", unit: "116", unit_status: "Notice-Unrented", bed_bath: "0/1.00", sqft: 485, last_move_out: ahead(29), available_on: ahead(39), next_move_in: null , property_id: 5 },
  { property_name: "Envoy", unit: "106", unit_status: "Notice-Rented", bed_bath: "0/1.00", sqft: 381, last_move_out: ahead(14), available_on: ahead(24), next_move_in: null , property_id: 6 },
  { property_name: "Kerry Park", unit: "A", unit_status: "Notice-Unrented", bed_bath: "0/1.00", sqft: 379, last_move_out: ahead(6), available_on: ahead(16), next_move_in: null , property_id: 7 },

  // ── Out of area — San Francisco, so it must not reach the board at all ───
  { property_name: "Far Away Place", unit: "700", unit_status: "Vacant-Unrented", bed_bath: "1/1.00", sqft: 700, last_move_out: ago(90), available_on: null, next_move_in: null, property_id: 8 },
  { property_name: "Far Away Place", unit: "701", unit_status: "Notice-Unrented", bed_bath: "1/1.00", sqft: 700, last_move_out: ahead(3), available_on: ahead(13), next_move_in: null, property_id: 8 },

  // ── Occupied — must appear on neither tab ─────────────────────────────────
  { property_name: "Ascona", unit: "300", unit_status: "Occupied", bed_bath: "1/1.00", sqft: 400, last_move_out: ago(400), available_on: null, next_move_in: null , property_id: 2 },
  { property_name: "Crosby", unit: "12", unit_status: "Occupied", bed_bath: "1/1.00", sqft: 600, last_move_out: null, available_on: null, next_move_in: null , property_id: 4 },
];

/** Property ids inside the four service areas — id 8 is deliberately not. */
const IN_AREA = new Set([1, 2, 3, 4, 5, 6, 7]);
const shown = FIXTURE_ROWS.filter((r) => r.property_id != null && IN_AREA.has(r.property_id));

export const VACANT_COUNT = shown.filter((r) => r.unit_status.startsWith("Vacant")).length;
export const UPCOMING_COUNT = shown.filter((r) => r.unit_status.startsWith("Notice")).length;

/** Units per service area on each tab, in the board's fixed area order. */
export const VACANT_BY_REGION: Record<string, number> = {
  Seattle: 6, // Alder Court 2 + Ascona 3 + Bel Vista 1 (Renton)
  SeaTac: 0,
  Eastside: 0,
  Burien: 2, // Crosby
};
export const UPCOMING_BY_REGION: Record<string, number> = {
  Seattle: 2, // DD Culp
  SeaTac: 1, // Envoy (Des Moines)
  Eastside: 1, // Kerry Park (Bellevue)
  Burien: 0,
};

// ── Fixtures for the nightly sync route ─────────────────────────────────────

/** `properties` rows the sync route resolves AppFolio ids against. */
export const PROPERTY_ROWS = [
  { id: 185, name: "Ascona", appfolio_id: "111" },
  { id: 190, name: "Ansonia", appfolio_id: "110" },
  // Deliberately unmapped: only a name match can resolve this one.
  { id: 223, name: "9275 Renton", appfolio_id: null },
];

/** Raw `unit_vacancy` report rows, in AppFolio's own field names. */
export const APPFOLIO_UNITS = [
  {
    property_id: 111, property_name: "Ascona", unit: "105", unit_id: 9001,
    unit_status: "Vacant-Unrented", last_move_out: ago(62), computed_market_rent: "1495",
    sqft: 327, bed_and_bath: "0/1.00", rent_ready: null, next_move_in: null,
    days_vacant: 62, available_on: ago(52), unit_turn_target_date: null,
  },
  {
    property_id: 111, property_name: "Ascona", unit: "202", unit_id: 9002,
    unit_status: "Vacant-Rented", last_move_out: ago(12), computed_market_rent: "1650",
    sqft: 315, bed_and_bath: "1/1.00", rent_ready: null, next_move_in: ahead(9),
    days_vacant: 12, available_on: ago(2), unit_turn_target_date: null,
  },
  {
    property_id: 110, property_name: "Ansonia", unit: "3", unit_id: 9003,
    unit_status: "Notice-Unrented", last_move_out: ahead(14), computed_market_rent: "1800",
    sqft: 600, bed_and_bath: "1/1.00", rent_ready: null, next_move_in: null,
    days_vacant: null, available_on: ahead(24), unit_turn_target_date: null,
  },
  // Resolvable only by name — its AppFolio id is not in PROPERTY_ROWS.
  {
    property_id: 777, property_name: "9275 Renton", unit: "A", unit_id: 9004,
    unit_status: "Vacant-Unrented", last_move_out: ago(5), computed_market_rent: "1400",
    sqft: 500, bed_and_bath: "2/1.50", rent_ready: null, next_move_in: null,
    days_vacant: 5, available_on: ago(1), unit_turn_target_date: null,
  },
  // Resolvable by neither — must still be recorded, and reported as unresolved.
  {
    property_id: 4242, property_name: "Brand New Building", unit: "1", unit_id: 9005,
    unit_status: "Vacant-Unrented", last_move_out: ago(3), computed_market_rent: "2000",
    sqft: 700, bed_and_bath: "1/1.00", rent_ready: null, next_move_in: null,
    days_vacant: 3, available_on: ago(1), unit_turn_target_date: null,
  },
  // Occupied — fetchVacantUnits filters these out before the snapshot write.
  {
    property_id: 111, property_name: "Ascona", unit: "300", unit_id: 9006,
    unit_status: "Occupied", last_move_out: ago(400), computed_market_rent: "1500",
    sqft: 400, bed_and_bath: "1/1.00", rent_ready: null, next_move_in: null,
    days_vacant: null, available_on: null, unit_turn_target_date: null,
  },
];

/** Buildings the sync route cannot map to a Supabase property. */
export const EXPECTED_UNRESOLVED = ["Brand New Building"];

/** Units expected in the snapshot write: every vacant or notice row above. */
export const EXPECTED_SNAPSHOT_UNITS = ["105", "202", "3", "A", "1"];

/** An older snapshot the board must ignore in favour of the newest one. */
export const STALE_SNAPSHOT_DATE = shiftDays(SNAPSHOT_DATE, -1);
export const STALE_ROWS: FixtureRow[] = [
  { property_name: "Should Not Appear", unit: "999", unit_status: "Vacant-Unrented", bed_bath: "1/1.00", sqft: 100, last_move_out: ago(500), available_on: null, next_move_in: null, property_id: 2 },
];
