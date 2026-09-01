import { expect, test, type APIRequestContext } from "@playwright/test";
import {
  EXPECTED_SNAPSHOT_UNITS,
  EXPECTED_UNRESOLVED,
  today,
} from "../support/vacancy-fixture.ts";

const CRON_SECRET = "e2e-cron-secret";
const SYNC_URL = "/api/appfolio/sync";
const MOCK = `http://127.0.0.1:${54321}`;

type SnapshotRow = {
  snapshot_date: string;
  property_id: number | null;
  property_name: string;
  unit: string;
  unit_status: string;
  bed_bath: string | null;
  sqft: number | null;
  last_move_out: string | null;
  available_on: string | null;
  next_move_in: string | null;
  source_file: string;
};

/** Rows the sync route pushed at the (mock) snapshot table. */
async function recordedUpserts(request: APIRequestContext) {
  const res = await request.get(`${MOCK}/__test__/upserts`);
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as { rows: SnapshotRow[]; onConflict: string | null }[];
}

async function clearUpserts(request: APIRequestContext) {
  await request.delete(`${MOCK}/__test__/upserts`);
}

async function runSync(request: APIRequestContext) {
  return request.get(SYNC_URL, {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
}

// These share the mock's recorded-upsert log, so they must not interleave.
test.describe.configure({ mode: "serial" });

test.describe("nightly vacancy snapshot sync", () => {
  test.beforeEach(async ({ request }) => {
    await clearUpserts(request);
  });

  test("rejects a caller without the cron secret", async ({ request }) => {
    const res = await request.get(SYNC_URL);
    expect(res.status()).toBe(401);
    // Nothing may be written on an unauthenticated call.
    expect(await recordedUpserts(request)).toHaveLength(0);
  });

  test("writes today's snapshot from the AppFolio feed", async ({ request }) => {
    const res = await runSync(request);
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(body.snapshot).toBeDefined();
    expect(body.snapshot.error).toBeUndefined();
    expect(body.snapshot.snapshot_date).toBe(today());
    expect(body.snapshot.written).toBe(EXPECTED_SNAPSHOT_UNITS.length);

    const calls = await recordedUpserts(request);
    expect(calls).toHaveLength(1);
    expect(calls[0].rows).toHaveLength(EXPECTED_SNAPSHOT_UNITS.length);
  });

  test("upserts on the table's natural key so a re-run cannot collide", async ({ request }) => {
    await runSync(request);
    const [call] = await recordedUpserts(request);
    // Without this the unique index would reject the second run of the day.
    expect(call.onConflict).toBe("snapshot_date,property_name,unit");
  });

  test("records the whole portfolio, not just turn-sync buildings", async ({ request }) => {
    // The mock returns no enabled buildings at all, so anything written here
    // proves the snapshot is not gated behind per-building turn-sync settings.
    await runSync(request);
    const [call] = await recordedUpserts(request);
    expect(call.rows.map((r) => r.unit).sort()).toEqual([...EXPECTED_SNAPSHOT_UNITS].sort());
  });

  test("resolves Supabase property ids, by AppFolio id and by name", async ({ request }) => {
    await runSync(request);
    const [call] = await recordedUpserts(request);
    const byUnit = Object.fromEntries(call.rows.map((r) => [r.unit, r]));

    // Matched on appfolio_id "111".
    expect(byUnit["105"].property_id).toBe(185);
    expect(byUnit["105"].property_name).toBe("Ascona");
    // Matched on name only — its AppFolio id is unmapped.
    expect(byUnit["A"].property_id).toBe(223);
    expect(byUnit["A"].property_name).toBe("9275 Renton");
  });

  test("still records an unmappable building, and names it in the response", async ({ request }) => {
    const res = await runSync(request);
    const body = await res.json();
    expect(body.snapshot.unresolved).toEqual(EXPECTED_UNRESOLVED);

    const [call] = await recordedUpserts(request);
    const orphan = call.rows.find((r) => r.property_name === "Brand New Building");
    // Recorded rather than dropped: property_id is nullable, and losing a
    // whole building's vacancies would be worse than losing the manager join.
    expect(orphan).toBeDefined();
    expect(orphan!.property_id).toBeNull();
  });

  test("leaves occupied units out of the snapshot", async ({ request }) => {
    await runSync(request);
    const [call] = await recordedUpserts(request);
    expect(call.rows.map((r) => r.unit_status)).not.toContain("Occupied");
    expect(call.rows.find((r) => r.unit === "300")).toBeUndefined();
  });

  test("carries the dates and unit details the board renders", async ({ request }) => {
    await runSync(request);
    const [call] = await recordedUpserts(request);
    const leased = call.rows.find((r) => r.unit === "202")!;

    expect(leased.unit_status).toBe("Vacant-Rented");
    expect(leased.next_move_in).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(leased.bed_bath).toBe("1/1.00");
    expect(leased.sqft).toBe(315);
    expect(leased.last_move_out).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(leased.source_file).toBe("appfolio_api:unit_vacancy");
  });

  test("running twice in one day stays idempotent", async ({ request }) => {
    // Vercel can retry a cron invocation; a manual re-run is also routine.
    await runSync(request);
    await runSync(request);
    const calls = await recordedUpserts(request);
    expect(calls).toHaveLength(2);

    const [first, second] = calls;
    expect(second.onConflict).toBe(first.onConflict);
    // Same key set both times — the second run updates the day, never doubles it.
    expect(second.rows.map((r) => `${r.property_name}|${r.unit}`).sort())
      .toEqual(first.rows.map((r) => `${r.property_name}|${r.unit}`).sort());
    expect(new Set(second.rows.map((r) => r.snapshot_date))).toEqual(new Set([today()]));
  });
});
