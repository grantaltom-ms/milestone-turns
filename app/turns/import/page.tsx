import { redirect } from "next/navigation";
import { ImportForm } from "@/components/import/ImportForm";
import { getCurrentProfile } from "@/lib/current-user";
import { loadProfiles } from "@/lib/data";
import { loadPropertyLookup } from "@/lib/import-data";
import { membersOnTeam } from "@/lib/stages";

export default async function ImportTurnsPage() {
  const [{ byName, nameById }, currentUser, profiles] = await Promise.all([
    loadPropertyLookup(),
    getCurrentProfile(),
    loadProfiles(),
  ]);

  if (!currentUser) redirect("/login");

  // Map → plain object for crossing the server/client boundary
  const byNameObj: Record<string, number> = {};
  byName.forEach((v, k) => { byNameObj[k] = v; });
  const nameByIdObj: Record<string, string> = {};
  nameById.forEach((v, k) => { nameByIdObj[String(k)] = v; });

  const officeMembers = membersOnTeam("office", profiles);

  return (
    <ImportForm
      propertyByName={byNameObj}
      propertyNameById={nameByIdObj}
      defaultAssignee={currentUser.initials}
      officeMembers={officeMembers}
    />
  );
}
