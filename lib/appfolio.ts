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
  /** Scheduled move-in date for the unit's next (already-leased) tenant.
   * Only populated when status is "Vacant-Rented" — null otherwise. */
  next_move_in: string | null;
  days_vacant: number | null;
  available_on: string | null;
  unit_turn_target_date: string | null;
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

type UnitVacancyRow = {
  property_id: number;
  property_name: string;
  unit: string;
  unit_id: number;
  unit_status: string;
  last_move_out: string | null;
  computed_market_rent: string | null;
  sqft: number | null;
  bed_and_bath: string | null;
  rent_ready: string | null;
  next_move_in: string | null;
  days_vacant: number | null;
  available_on: string | null;
  unit_turn_target_date: string | null;
};

export async function fetchVacantUnits(): Promise<AppfolioVacantUnit[]> {
  const subdomain = process.env.APPFOLIO_SUBDOMAIN;
  if (!subdomain) throw new Error("APPFOLIO_SUBDOMAIN must be set");

  const auth = authHeader();
  let url: string | null = `https://${subdomain}/api/v2/reports/unit_vacancy.json`;
  const rows: UnitVacancyRow[] = [];

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
    const pageRows: UnitVacancyRow[] = Array.isArray(data)
      ? data
      : (data.results ?? []);
    rows.push(...pageRows);
    url = typeof data?.next_page_url === "string" ? data.next_page_url : null;
  }

  return rows
    .filter(
      (r): r is UnitVacancyRow & { unit_status: AppfolioUnitStatus } =>
        r.unit_status === "Vacant-Unrented" ||
        r.unit_status === "Vacant-Rented" ||
        r.unit_status === "Notice-Unrented" ||
        r.unit_status === "Notice-Rented",
    )
    .map((r) => ({
      property_id: r.property_id,
      property_name: r.property_name,
      unit: r.unit,
      unit_id: r.unit_id,
      status: r.unit_status,
      last_move_out: r.last_move_out ?? null,
      market_rent: r.computed_market_rent ?? null,
      sqft: r.sqft ?? null,
      bd_ba: r.bed_and_bath ?? null,
      rent_ready: r.rent_ready ?? null,
      next_move_in: r.next_move_in ?? null,
      days_vacant: r.days_vacant ?? null,
      available_on: r.available_on ?? null,
      unit_turn_target_date: r.unit_turn_target_date ?? null,
    }));
}
