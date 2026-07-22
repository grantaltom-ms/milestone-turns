import { redirect } from "next/navigation";
import { ImportForm } from "@/components/import/ImportForm";
import { getCurrentProfile } from "@/lib/current-user";
import { loadProfiles } from "@/lib/data";
import { loadPropertyLookup } from "@/lib/import-data";
import { membersOnTeam } from "@/lib/stages";
import { getServerSupabase } from "@/lib/supabase/server";

export default async function ImportTurnsPage() {
  const supabase = await getServerSupabase();

  const [{ byName, nameById }, currentUser, profiles, activeTurnsRes] = await Promise.all([
    loadPropertyLookup(),
    getCurrentProfile(),
    loadProfiles(),
    supabase.from("turns").select("property_id, unit").lt("stage_idx", 4),
  ]);

  if (!currentUser) redirect("/login");

  // Map → plain object for crossing the server/client boundary
  const byNameObj: Record<string, number> = {};
  byName.forEach((v, k) => { byNameObj[k] = v; });
  const nameByIdObj: Record<string, string> = {};
  nameById.forEach((v, k) => { nameByIdObj[String(k)] = v; });

  // Build a set of "property_id:unit" keys for active turns so the preview
  // can flag rows that would be skipped as duplicates.
  const activeUnitKeys = (activeTurnsRes.data ?? []).map(
    (t) => `${t.property_id}:${t.unit}`,
  );

  const officeMembers = membersOnTeam("office", profiles);

  return (
    <ImportForm
      propertyByName={byNameObj}
      propertyNameById={nameByIdObj}
      defaultAssignee={currentUser.initials}
      officeMembers={officeMembers}
      activeUnitKeys={activeUnitKeys}
    />
  );
}
