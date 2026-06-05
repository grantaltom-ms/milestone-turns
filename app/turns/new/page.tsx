import { redirect } from "next/navigation";
import { NewTurnForm } from "@/components/new-turn/NewTurnForm";
import { getCurrentProfile } from "@/lib/current-user";
import { loadProfiles, loadProperties, loadStageDefaultTasks } from "@/lib/data";
import { membersOnTeam } from "@/lib/stages";

export default async function NewTurnPage() {
  const [properties, profiles, currentUser, inspectionDefaults] = await Promise.all([
    loadProperties(),
    loadProfiles(),
    getCurrentProfile(),
    loadStageDefaultTasks(0),
  ]);

  if (!currentUser) redirect("/login");

  // New turns start at Inspection (stage 0 = office team)
  const officeMembers = membersOnTeam("office", profiles);

  return (
    <NewTurnForm
      properties={properties}
      defaultAssignee={currentUser.initials}
      officeMembers={officeMembers}
      inspectionDefaults={inspectionDefaults.map((t) => t.name)}
    />
  );
}
