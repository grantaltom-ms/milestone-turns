/**
 * Pure shaping logic for the maintenance vacancy board.
 *
 * Kept free of Supabase/React imports so it can be unit-tested directly and
 * so the page component stays a thin renderer. Input is raw
 * `unit_vacancy_snapshots` rows; output is the two grouped lists the board
 * shows: units empty right now, and units whose tenant has given notice.
 */

export type VacancySnapshotRow = {
  property_name: string | null;
  unit: string | null;
  unit_status: string | null;
  bed_bath: string | null;
  sqft: number | null;
  last_move_out: string | null;
  available_on: string | null;
  next_move_in: string | null;
};

export type VacantUnit = {
  key: string;
  unit: string;
  size: string | null;
  sqft: number | null;
  /** Whole days since the tenant moved out. Null when the date is missing. */
  daysVacant: number | null;
  vacatedOn: string | null;
  /** Already leased to someone — a move-in date is locked in. */
  moveIn: string | null;
};

export type UpcomingUnit = {
  key: string;
  unit: string;
  size: string | null;
  sqft: number | null;
  movesOut: string | null;
  availableOn: string | null;
  /** Whole days from today until move-out. Negative means the date has passed. */
  daysUntilOut: number | null;
};

export type BuildingGroup<T> = { building: string; units: T[] };

export type VacancyBoard = {
  vacant: BuildingGroup<VacantUnit>[];
  upcoming: BuildingGroup<UpcomingUnit>[];
  vacantCount: number;
  upcomingCount: number;
  /** Vacant units sitting 30+ days — the ones worth chasing. */
  longVacantCount: number;
};

/** Whole-day difference between two YYYY-MM-DD strings (to − from). */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** Today in Seattle, as YYYY-MM-DD. Server clocks run UTC, which rolls the
 *  date forward mid-evening Pacific and would age every unit by a day. */
export function todayInSeattle(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** "0/1.00" → "Studio · 1 ba"; "2/1.50" → "2 bd · 1.5 ba". */
export function formatSize(bedBath: string | null): string | null {
  if (!bedBath) return null;
  const [bedRaw, bathRaw] = bedBath.split("/");
  const beds = Number(bedRaw);
  const baths = Number(bathRaw);
  const bedLabel = Number.isFinite(beds) ? (beds === 0 ? "Studio" : `${beds} bd`) : null;
  const bathLabel = Number.isFinite(baths) ? `${String(baths).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1")} ba` : null;
  const parts = [bedLabel, bathLabel].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** "2026-09-15" → "Sep 15". Returns null for a missing/unparseable date. */
export function formatDay(iso: string | null): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[Number(m[2]) - 1];
  return month ? `${month} ${Number(m[3])}` : null;
}

function groupByBuilding<T>(rows: Array<{ building: string; unit: T }>): BuildingGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const { building, unit } of rows) {
    const list = map.get(building);
    if (list) list.push(unit);
    else map.set(building, [unit]);
  }
  return Array.from(map, ([building, units]) => ({ building, units }));
}

/** Natural-ish unit ordering so "2" sorts before "10" and "4207B" stays put. */
function compareUnits(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}

/** A-Z by building name, case-insensitive, with numeric-led names ("9275
 *  Renton") ordered by value rather than digit by digit. */
function compareBuildings(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}

export function buildVacancyBoard(rows: VacancySnapshotRow[], today: string): VacancyBoard {
  const vacantRows: Array<{ building: string; unit: VacantUnit }> = [];
  const upcomingRows: Array<{ building: string; unit: UpcomingUnit }> = [];

  for (const row of rows) {
    const building = row.property_name?.trim() || "Unknown building";
    const unit = row.unit?.trim() || "—";
    const status = row.unit_status ?? "";
    const key = `${building}:${unit}`;
    const size = formatSize(row.bed_bath);

    if (status.startsWith("Vacant")) {
      vacantRows.push({
        building,
        unit: {
          key,
          unit,
          size,
          sqft: row.sqft,
          // A move-out dated in the future on a already-vacant unit is a data
          // quirk, not negative time — floor it at zero.
          daysVacant: row.last_move_out ? Math.max(0, daysBetween(row.last_move_out, today)) : null,
          vacatedOn: row.last_move_out,
          moveIn: row.next_move_in,
        },
      });
    } else if (status.startsWith("Notice")) {
      upcomingRows.push({
        building,
        unit: {
          key,
          unit,
          size,
          sqft: row.sqft,
          movesOut: row.last_move_out,
          availableOn: row.available_on,
          daysUntilOut: row.last_move_out ? daysBetween(today, row.last_move_out) : null,
        },
      });
    }
  }

  const vacant = groupByBuilding(vacantRows);
  for (const group of vacant) {
    // Longest-empty first inside each building.
    group.units.sort(
      (a, b) => (b.daysVacant ?? -1) - (a.daysVacant ?? -1) || compareUnits(a.unit, b.unit),
    );
  }
  // Buildings in alphabetical order. The list is a lookup — "what's going on
  // at Ascona?" — so a fixed A-Z order lets someone find a building by
  // position, which an urgency-ranked order (where a building moves as its
  // units age) does not. Urgency still shows in the day badges and in the
  // unit order within each building.
  vacant.sort((a, b) => compareBuildings(a.building, b.building));

  const upcoming = groupByBuilding(upcomingRows);
  for (const group of upcoming) {
    // Soonest move-out first — that is the date he has to plan around.
    group.units.sort(
      (a, b) =>
        (a.daysUntilOut ?? Number.MAX_SAFE_INTEGER) - (b.daysUntilOut ?? Number.MAX_SAFE_INTEGER) ||
        compareUnits(a.unit, b.unit),
    );
  }
  upcoming.sort((a, b) => compareBuildings(a.building, b.building));

  return {
    vacant,
    upcoming,
    vacantCount: vacantRows.length,
    upcomingCount: upcomingRows.length,
    longVacantCount: vacantRows.filter((r) => (r.unit.daysVacant ?? 0) >= 30).length,
  };
}
