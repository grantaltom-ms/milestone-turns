import { redirect } from "next/navigation";
import { NewTurnForm } from "@/components/new-turn/NewTurnForm";
import { getCurrentProfile } from "@/lib/current-user";
import { loadProfiles, loadProperties } from "@/lib/data";
import { membersOnTeam } from "@/lib/stages";

export default async function NewTurnPage() {
  const [properties, profiles, currentUser] = await Promise.all([
    loadProperties(),
    loadProfiles(),
    getCurrentProfile(),
  ]);

  if (!currentUser) redirect("/login");

  // New turns start at Inspection (stage 0 = office team)
  const officeMembers = membersOnTeam("office", profiles);

  return (
    <NewTurnForm
      properties={properties}
      defaultAssignee={currentUser.initials}
      officeMembers={officeMembers}
    />
  );
}
