import { cache } from "react";
import { getServerSupabase } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

/**
 * Property IDs the given user is allowed to see.
 *   - `null`  → no restriction (see every building).
 *   - array   → see ONLY these buildings.
 *
 * Admins always see everything. A user with no explicit assignments also sees
 * everything (restriction is opt-in per user). Cached per request so multiple
 * loaders share one lookup.
 */
export const getVisiblePropertyIds = cache(
  async (profile: Profile | null): Promise<number[] | null> => {
    if (!profile) return null;
    if (profile.role === "admin") return null; // admins bypass
    const supabase = await getServerSupabase();
    const { data } = await supabase
      .from("user_building_access")
      .select("property_id")
      .eq("profile_id", profile.id);
    if (!data || data.length === 0) return null; // no assignment → sees all
    return (data as { property_id: number }[]).map((r) => r.property_id);
  },
);

/** True if the user may view a turn in the given building. */
export function canSeeProperty(visible: number[] | null, propertyId: number): boolean {
  return visible === null || visible.includes(propertyId);
}
