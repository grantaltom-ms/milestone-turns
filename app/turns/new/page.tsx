import { NewTurnForm } from "@/components/new-turn/NewTurnForm";
import { getCurrentInitials } from "@/lib/current-user";
import { loadProperties } from "@/lib/data";

export default async function NewTurnPage() {
  const [properties, defaultAssignee] = await Promise.all([
    loadProperties(),
    getCurrentInitials(),
  ]);
  return <NewTurnForm properties={properties} defaultAssignee={defaultAssignee} />;
}
