import assert from "node:assert/strict";
import { test } from "node:test";
import type { AppfolioVacantUnit } from "../lib/appfolio.ts";
import { buildSnapshotRows, SNAPSHOT_SOURCE, type PropertyRef } from "../lib/vacancy-snapshot.ts";

const DATE = "2026-09-01";

const PROPERTIES: PropertyRef[] = [
  { id: 185, name: "Ascona", appfolio_id: "111" },
  { id: 190, name: "Ansonia", appfolio_id: "110" },
  // Seeded without an AppFolio id — only a name match can resolve it.
  { id: 223, name: "9275 Renton", appfolio_id: null },
];

function unit(over: Partial<AppfolioVacantUnit>): AppfolioVacantUnit {
  return {
    property_id: 111,
    property_name: "Ascona",
    unit: "105",
    unit_id: 1,
    status: "Vacant-Unrented",
    last_move_out: "2026-07-01",
    market_rent: "1500",
    sqft: 327,
    bd_ba: "0/1.00",
    rent_ready: null,
    next_move_in: null,
    days_vacant: 62,
    available_on: "2026-07-11",
    unit_turn_target_date: null,
    description: null,
    street_address: null,
    city: null,
    state: null,
    zip: null,
    ...over,
  };
}

test("resolves the Supabase property id from AppFolio's property id", () => {
  const { rows, unresolved } = buildSnapshotRows([unit({})], PROPERTIES, DATE);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].property_id, 185);
  assert.equal(rows[0].property_name, "Ascona");
  assert.deepEqual(unresolved, []);
});

test("falls back to a case-insensitive name match when the id is unmapped", () => {
  const { rows, unresolved } = buildSnapshotRows(
    [unit({ property_id: 999, property_name: "  9275 RENTON  " })],
    PROPERTIES,
    DATE,
  );
  assert.equal(rows[0].property_id, 223);
  // The Supabase spelling wins, so the natural key stays stable.
  assert.equal(rows[0].property_name, "9275 Renton");
  assert.deepEqual(unresolved, []);
});

test("still records a building it cannot resolve, and reports it", () => {
  const { rows, unresolved } = buildSnapshotRows(
    [unit({ property_id: 4242, property_name: "Brand New Building" })],
    PROPERTIES,
    DATE,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].property_id, null);
  assert.equal(rows[0].property_name, "Brand New Building");
  assert.deepEqual(unresolved, ["Brand New Building"]);
});

test("maps every column the snapshot table and its views read", () => {
  const { rows } = buildSnapshotRows(
    [unit({ status: "Notice-Rented", next_move_in: "2026-09-20", sqft: 880, bd_ba: "2/1.50" })],
    PROPERTIES,
    DATE,
  );
  assert.deepEqual(rows[0], {
    snapshot_date: DATE,
    property_id: 185,
    property_name: "Ascona",
    unit: "105",
    bed_bath: "2/1.50",
    sqft: 880,
    unit_status: "Notice-Rented",
    last_move_out: "2026-07-01",
    available_on: "2026-07-11",
    next_move_in: "2026-09-20",
    description: null,
    street_address: null,
    city: null,
    state: null,
    zip: null,
    source_file: SNAPSHOT_SOURCE,
  });
});

test("passes listing/address detail through when the report supplies it", () => {
  const { rows } = buildSnapshotRows(
    [
      unit({
        description: "Great light, top floor.",
        street_address: "200 5th Ave S #105 Seattle, WA 98104",
        city: "Seattle",
        state: "WA",
        zip: "98104",
      }),
    ],
    PROPERTIES,
    DATE,
  );
  assert.equal(rows[0].description, "Great light, top floor.");
  assert.equal(rows[0].street_address, "200 5th Ave S #105 Seattle, WA 98104");
  assert.equal(rows[0].city, "Seattle");
  assert.equal(rows[0].state, "WA");
  assert.equal(rows[0].zip, "98104");
});

test("tags rows with a source that distinguishes them from CSV uploads", () => {
  const { rows } = buildSnapshotRows([unit({})], PROPERTIES, DATE);
  assert.equal(rows[0].source_file, SNAPSHOT_SOURCE);
  assert.ok(!/\.csv$/.test(rows[0].source_file), "cron rows must not look like a CSV upload");
});

test("collapses a duplicate building+unit so the upsert cannot self-conflict", () => {
  // The natural key permits one row per building+unit per day; two rows for
  // the same key in one payload would fail the whole upsert.
  const { rows } = buildSnapshotRows(
    [unit({ unit: "105" }), unit({ unit: "105", status: "Notice-Unrented" })],
    PROPERTIES,
    DATE,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].unit_status, "Vacant-Unrented");
});

test("a building reached by id and by name resolves to one key, not two", () => {
  const { rows } = buildSnapshotRows(
    [unit({ unit: "105" }), unit({ unit: "105", property_id: 999, property_name: "ascona" })],
    PROPERTIES,
    DATE,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].property_name, "Ascona");
});

test("trims unit labels and skips rows the table would reject as null", () => {
  const { rows } = buildSnapshotRows(
    [
      unit({ unit: "  202  " }),
      unit({ unit: "   " }),
      unit({ property_id: 0, property_name: "", unit: "5" }),
    ],
    PROPERTIES,
    DATE,
  );
  assert.deepEqual(rows.map((r) => r.unit), ["202"]);
});

test("carries missing optional dates through as null rather than undefined", () => {
  const { rows } = buildSnapshotRows(
    [unit({ last_move_out: null, available_on: null, next_move_in: null, sqft: null, bd_ba: null })],
    PROPERTIES,
    DATE,
  );
  assert.deepEqual(
    { ...rows[0] },
    {
      snapshot_date: DATE,
      property_id: 185,
      property_name: "Ascona",
      unit: "105",
      bed_bath: null,
      sqft: null,
      unit_status: "Vacant-Unrented",
      last_move_out: null,
      available_on: null,
      next_move_in: null,
      description: null,
      street_address: null,
      city: null,
      state: null,
      zip: null,
      source_file: SNAPSHOT_SOURCE,
    },
  );
});

test("handles an empty AppFolio response without inventing rows", () => {
  const { rows, unresolved } = buildSnapshotRows([], PROPERTIES, DATE);
  assert.deepEqual(rows, []);
  assert.deepEqual(unresolved, []);
});

test("keeps every building in a realistic multi-building pull", () => {
  const { rows } = buildSnapshotRows(
    [
      unit({ property_id: 111, property_name: "Ascona", unit: "105" }),
      unit({ property_id: 111, property_name: "Ascona", unit: "202" }),
      unit({ property_id: 110, property_name: "Ansonia", unit: "3" }),
      unit({ property_id: 999, property_name: "9275 Renton", unit: "A" }),
    ],
    PROPERTIES,
    DATE,
  );
  assert.equal(rows.length, 4);
  assert.deepEqual(
    [...new Set(rows.map((r) => r.property_id))].sort((a, b) => Number(a) - Number(b)),
    [185, 190, 223],
  );
});
