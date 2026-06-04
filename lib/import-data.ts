import { getServerSupabase } from "@/lib/supabase/server";
import { normalizeName } from "@/lib/csv-import";

export type PropertyOption = { id: number; name: string };

export async function loadPropertyLookup(): Promise<{
  byName: Map<string, number>;
  nameById: Map<number, string>;
  all: PropertyOption[];
}> {
  const supabase = await getServerSupabase();
  const [propsRes, aliasRes] = await Promise.all([
    supabase.from("properties").select("id, name").eq("is_group", false),
    supabase.from("property_aliases").select("alias, property_id"),
  ]);
  if (propsRes.error) throw propsRes.error;
  if (aliasRes.error) throw aliasRes.error;

  const byName = new Map<string, number>();
  const nameById = new Map<number, string>();
  for (const row of propsRes.data ?? []) {
    byName.set(normalizeName(row.name), row.id);
    nameById.set(row.id, row.name);
  }
  // Aliases never overwrite a canonical match
  for (const a of aliasRes.data ?? []) {
    const key = normalizeName(a.alias);
    if (!byName.has(key)) byName.set(key, a.property_id);
  }

  const all = (propsRes.data ?? [])
    .map((r) => ({ id: r.id, name: r.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { byName, nameById, all };
}
