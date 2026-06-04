import { TEAM } from "@/lib/stages";

export type PropertyLookup = Map<string, number>; // normalized name → property_id

// CSV columns we read (matches AppFolio "Unit Vacancy Detail" export). Others
// in the file (Bed/Bath, Sqft, Unit Status, Rent Ready, Days Vacant, Next Move In)
// are ignored.
export const REQUIRED_COLUMNS = [
  "property name",
  "unit",
  "last move out",
  "available on",
] as const;

export const IGNORED_COLUMNS = [
  "bed/bath",
  "sqft",
  "unit status",
  "rent ready",
  "days vacant",
  "next move in",
] as const;

export type RawRow = {
  property: string;       // ← "Property Name"
  unit: string;           // ← "Unit"
  vacate_date: string;    // ← "Last Move Out"
  target_date: string;    // ← "Available On"
  unit_status?: string;   // optional context for the preview row
};

export type ParsedRow = {
  rowNumber: number; // 1-based, excluding header
  raw: RawRow;
  property_id: number | null;
  property_name_resolved: string | null;
  unit_normalized: string;
  vacate_iso: string;
  target_iso: string;
  errors: string[];
  skip: boolean; // true when the row is structurally empty (separator/total)
};

export function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

// Try a few fallback forms for property names — AppFolio appends "Apartments",
// "Apts", etc. that may not be in properties.name.
const PROPERTY_SUFFIXES = [
  /\s+apartments?$/i,
  /\s+apts?\.?$/i,
  /\s+condos?$/i,
  /\s+lofts?$/i,
];

export function lookupPropertyId(
  raw: string,
  byName: PropertyLookup,
): { id: number | null; resolvedName: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { id: null, resolvedName: null };
  const direct = byName.get(normalizeName(trimmed));
  if (direct != null) return { id: direct, resolvedName: null };

  for (const suffix of PROPERTY_SUFFIXES) {
    const stripped = trimmed.replace(suffix, "");
    if (stripped === trimmed) continue;
    const hit = byName.get(normalizeName(stripped));
    if (hit != null) return { id: hit, resolvedName: null };
  }
  return { id: null, resolvedName: null };
}

// MM/DD/YYYY → YYYY-MM-DD. Returns "" if it can't parse.
export function toIsoDate(s: string): string {
  const t = s.trim();
  if (!t) return "";
  // Already ISO?
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(t);
  if (!m) return "";
  let [, mo, da, yr] = m;
  if (yr.length === 2) yr = (Number(yr) >= 70 ? "19" : "20") + yr;
  return `${yr}-${mo.padStart(2, "0")}-${da.padStart(2, "0")}`;
}

// "204" → "#204"; "A 101" → "A 101" (leave alone if it has letters).
export function normalizeUnit(s: string): string {
  const t = s.trim();
  if (!t) return "";
  if (/^\d+$/.test(t)) return "#" + t;
  if (t.startsWith("#")) return t;
  return t;
}

export function validateRow(
  raw: RawRow,
  rowNumber: number,
  byName: PropertyLookup,
  nameById: Map<number, string>,
  assignee: string,
): ParsedRow {
  const errors: string[] = [];

  // Treat empty-property rows as separators (AppFolio puts blanks between
  // property groups). Skip silently rather than erroring.
  const structurallyEmpty =
    !raw.property.trim() && !raw.unit.trim() && !raw.vacate_date.trim() && !raw.target_date.trim();

  const { id: property_id } = lookupPropertyId(raw.property, byName);
  if (!structurallyEmpty) {
    if (!raw.property.trim()) errors.push("property is empty");
    else if (property_id == null) errors.push(`property "${raw.property}" not found`);
  }

  const unit_normalized = normalizeUnit(raw.unit);
  if (!structurallyEmpty && !unit_normalized) errors.push("unit is empty");

  const vacate_iso = toIsoDate(raw.vacate_date);
  if (!structurallyEmpty) {
    if (!raw.vacate_date.trim()) errors.push("last move out is empty");
    else if (!vacate_iso) errors.push(`last move out "${raw.vacate_date}" not a date`);
  }

  const target_iso = toIsoDate(raw.target_date);
  if (!structurallyEmpty) {
    if (!raw.target_date.trim()) errors.push("available on is empty");
    else if (!target_iso) errors.push(`available on "${raw.target_date}" not a date`);
  }

  if (!structurallyEmpty) {
    const upper = assignee.trim().toUpperCase();
    if (!upper) errors.push("no assignee picked");
    else if (!TEAM.includes(upper as (typeof TEAM)[number])) {
      errors.push(`assignee "${assignee}" not on team`);
    }
  }

  return {
    rowNumber,
    raw,
    property_id,
    property_name_resolved: property_id != null ? (nameById.get(property_id) ?? null) : null,
    unit_normalized,
    vacate_iso,
    target_iso,
    errors,
    skip: structurallyEmpty,
  };
}
