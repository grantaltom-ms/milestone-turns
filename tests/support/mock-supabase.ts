/**
 * Stand-ins for the two services the app talks to, complete enough to serve
 * the queries the vacancy board and the nightly sync route actually make.
 * Lets the end-to-end tests exercise the real pages, the real query builder
 * and the real AppFolio client against fixed data — no network, no
 * credentials, and no drift as the live snapshot changes.
 *
 * Also records what the sync route wrote, so a test can assert the exact
 * rows that would land in `unit_vacancy_snapshots`.
 */
import { createServer, type IncomingMessage } from "node:http";
import {
  APPFOLIO_UNITS,
  BOARD_PROPERTY_ROWS,
  FIXTURE_ROWS,
  PROPERTY_ROWS,
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

/** Everything the sync route has upserted, newest call last. */
const upserts: { rows: unknown[]; onConflict: string | null }[] = [];

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

/** Apply PostgREST's `select` column projection. */
function project<T extends Record<string, unknown>>(rows: T[], select: string | null): T[] {
  if (!select || select === "*") return rows;
  const cols = select.split(",").map((c) => c.trim()).filter(Boolean);
  return rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const c of cols) out[c] = r[c] ?? null;
    return out as T;
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  const json = (status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  // ── Test-only introspection: what did the sync route write? ───────────────
  if (url.pathname === "/__test__/upserts") {
    if (req.method === "DELETE") {
      upserts.length = 0;
      return json(200, { cleared: true });
    }
    return json(200, upserts);
  }

  // ── AppFolio: the unit_vacancy report (a POST, per the API) ───────────────
  if (url.pathname === "/api/v2/reports/unit_vacancy.json") {
    if (!(req.headers.authorization ?? "").startsWith("Basic ")) {
      return json(401, { message: "missing basic auth" });
    }
    return json(200, { results: APPFOLIO_UNITS, next_page_url: null });
  }

  // ── Supabase ──────────────────────────────────────────────────────────────
  // The root layout resolves the signed-in user; the board has none.
  if (url.pathname.startsWith("/auth/v1/")) {
    return json(401, { message: "no session" });
  }

  if (url.pathname === "/rest/v1/properties") {
    // Two callers read this table for different things: the board asks for
    // `city` to place buildings in a service area, the sync route asks for
    // `appfolio_id` to resolve ids. Serve each the fixture it is about.
    const select = url.searchParams.get("select") ?? "";
    const rows = select.includes("city") ? BOARD_PROPERTY_ROWS : PROPERTY_ROWS;
    return json(200, project([...rows] as Record<string, unknown>[], select));
  }

  // The sync route reads this to decide which buildings get turns created.
  // Empty keeps the test focused on the snapshot write: the route must still
  // record the snapshot even when no building is opted into turn sync.
  if (url.pathname === "/rest/v1/appfolio_sync_settings") {
    return json(200, []);
  }

  if (url.pathname !== "/rest/v1/unit_vacancy_snapshots") {
    return json(404, { message: `unexpected path ${url.pathname}` });
  }

  if (req.method === "POST") {
    // supabase-js `.upsert()` POSTs the rows with an on_conflict query param.
    const body = await readBody(req);
    let rows: unknown[] = [];
    try {
      const parsed = JSON.parse(body);
      rows = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return json(400, { message: "unparseable body" });
    }
    upserts.push({ rows, onConflict: url.searchParams.get("on_conflict") });
    res.writeHead(201, { "content-type": "application/json" });
    return res.end("[]");
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

  return json(200, project(rows, url.searchParams.get("select")));
});

server.listen(PORT, () => {
  console.log(`mock supabase + appfolio listening on http://127.0.0.1:${PORT}`);
});
