/**
 * A stand-in for Supabase's PostgREST endpoint, just complete enough to serve
 * the two queries `loadLatestVacancySnapshot` makes. Lets the end-to-end test
 * exercise the real page, real query builder and real rendering against fixed
 * data — no network, no credentials, no drift as the live snapshot changes.
 */
import { createServer } from "node:http";
import {
  FIXTURE_ROWS,
  SNAPSHOT_DATE,
  STALE_ROWS,
  STALE_SNAPSHOT_DATE,
  type FixtureRow,
} from "./vacancy-fixture.ts";

const PORT = Number(process.env.MOCK_SUPABASE_PORT ?? 54321);

const TABLE: Array<FixtureRow & { snapshot_date: string }> = [
  ...FIXTURE_ROWS.map((r) => ({ ...r, snapshot_date: SNAPSHOT_DATE })),
  ...STALE_ROWS.map((r) => ({ ...r, snapshot_date: STALE_SNAPSHOT_DATE })),
];

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  const json = (status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  // The root layout resolves the signed-in user; the board has none.
  if (url.pathname.startsWith("/auth/v1/")) {
    return json(401, { message: "no session" });
  }

  if (url.pathname !== "/rest/v1/unit_vacancy_snapshots") {
    return json(404, { message: `unexpected path ${url.pathname}` });
  }

  let rows = [...TABLE];

  // `.eq("snapshot_date", …)` arrives as ?snapshot_date=eq.YYYY-MM-DD
  const eq = url.searchParams.get("snapshot_date");
  if (eq?.startsWith("eq.")) {
    const wanted = eq.slice(3);
    rows = rows.filter((r) => r.snapshot_date === wanted);
  }

  if (url.searchParams.get("order") === "snapshot_date.desc") {
    rows.sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date));
  }

  const limit = url.searchParams.get("limit");
  if (limit) rows = rows.slice(0, Number(limit));

  // Project only the requested columns, mirroring PostgREST's `select`.
  const select = url.searchParams.get("select");
  if (select && select !== "*") {
    const cols = select.split(",").map((c) => c.trim()).filter(Boolean);
    rows = rows.map((r) => {
      const out: Record<string, unknown> = {};
      for (const c of cols) out[c] = (r as unknown as Record<string, unknown>)[c] ?? null;
      return out as (typeof rows)[number];
    });
  }

  return json(200, rows);
});

server.listen(PORT, () => {
  console.log(`mock supabase listening on http://127.0.0.1:${PORT}`);
});
