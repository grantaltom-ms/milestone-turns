/**
 * The service areas the maintenance vacancy board groups buildings into.
 *
 * These are operational areas, not literal city limits — a few neighbouring
 * cities are worked as one patch, so they share a tile. A building whose city
 * is not listed here is deliberately left off the board: the portfolio holds
 * a couple of out-of-area properties (San Francisco, Vancouver) that the
 * head of maintenance does not cover.
 */

export const REGIONS = ["Seattle", "SeaTac", "Eastside", "Burien"] as const;

export type Region = (typeof REGIONS)[number];

/** Cities belonging to each area, lower-cased for matching. */
const CITIES_BY_REGION: Record<Region, readonly string[]> = {
  Seattle: ["seattle", "renton"],
  SeaTac: ["seatac", "des moines"],
  Eastside: ["issaquah", "bellevue", "redmond"],
  Burien: ["burien"],
};

const REGION_BY_CITY = new Map<string, Region>();
for (const region of REGIONS) {
  for (const city of CITIES_BY_REGION[region]) REGION_BY_CITY.set(city, region);
}

/** Case- and spacing-insensitive: the data carries both "SeaTac" and "Seatac". */
function normalizeCity(city: string): string {
  return city.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * The area a city belongs to, or null when it is outside all of them.
 *
 * Null is a real answer, not a failure: out-of-area buildings are meant to
 * drop off the board. Callers should not invent a fallback bucket for them.
 */
export function regionForCity(city: string | null | undefined): Region | null {
  if (!city) return null;
  return REGION_BY_CITY.get(normalizeCity(city)) ?? null;
}
