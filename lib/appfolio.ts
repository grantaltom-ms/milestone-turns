/**
 * Server-side AppFolio API v2 client.
 * Only import from server components, actions, or API routes.
 */

export type AppfolioUnitStatus =
  | "Vacant-Unrented"
  | "Vacant-Rented"
  | "Notice-Unrented"
  | "Notice-Rented";

export interface AppfolioVacantUnit {
  property_id: number;
  property_name: string;
  unit: string;
  unit_id: number;
  status: AppfolioUnitStatus;
  last_move_out: string | null;
  market_rent: string | null;
  sqft: number | null;
  bd_ba: string | null;
  rent_ready: string | null;
}

function authHeader(): string {
  const clientId = process.env.APPFOLIO_CLIENT_ID;
  const clientSecret = process.env.APPFOLIO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("APPFOLIO_CLIENT_ID and APPFOLIO_CLIENT_SECRET must be set");
  }
  const token = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  return `Basic ${token}`;
}

type RentRollRow = {
  property_id: number;
  property_name: string;
  unit: string;
  unit_id: number;
  status: string;
  last_move_out: string | null;
  market_rent: string | null;
  sqft: number | null;
  bd_ba: string | null;
  rent_ready: string | null;
};

export async function fetchVacantUnits(): Promise<AppfolioVacantUnit[]> {
  const subdomain = process.env.APPFOLIO_SUBDOMAIN;
  if (!subdomain) throw new Error("APPFOLIO_SUBDOMAIN must be set");

  const auth = authHeader();
  let url: string | null = `https://${subdomain}/api/v2/reports/rent_roll.json`;
  const rows: RentRollRow[] = [];

  while (url) {
    const resp: Response = await fetch(url, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ paginate_results: true }),
      cache: "no-store",
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`AppFolio API error ${resp.status}: ${body}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await resp.json();
    const pageRows: RentRollRow[] = Array.isArray(data)
      ? data
      : (data.results ?? []);
    rows.push(...pageRows);
    url = typeof data?.next_page_url === "string" ? data.next_page_url : null;
  }

  return rows
    .filter(
      (r): r is RentRollRow & { status: AppfolioUnitStatus } =>
        r.status === "Vacant-Unrented" ||
        r.status === "Vacant-Rented" ||
        r.status === "Notice-Unrented" ||
        r.status === "Notice-Rented",
    )
    .map((r) => ({
      property_id: r.property_id,
      property_name: r.property_name,
      unit: r.unit,
      unit_id: r.unit_id,
      status: r.status,
      last_move_out: r.last_move_out ?? null,
      market_rent: r.market_rent ?? null,
      sqft: r.sqft ?? null,
      bd_ba: r.bd_ba ?? null,
      rent_ready: r.rent_ready ?? null,
    }));
}
