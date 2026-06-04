import { ImportForm } from "@/components/import/ImportForm";
import { getCurrentInitials } from "@/lib/current-user";
import { loadPropertyLookup } from "@/lib/import-data";

export default async function ImportTurnsPage() {
  const [{ byName, nameById }, defaultAssignee] = await Promise.all([
    loadPropertyLookup(),
    getCurrentInitials(),
  ]);

  // Map → plain object for crossing the server/client boundary
  const byNameObj: Record<string, number> = {};
  byName.forEach((v, k) => { byNameObj[k] = v; });
  const nameByIdObj: Record<string, string> = {};
  nameById.forEach((v, k) => { nameByIdObj[String(k)] = v; });

  return (
    <ImportForm
      propertyByName={byNameObj}
      propertyNameById={nameByIdObj}
      defaultAssignee={defaultAssignee}
    />
  );
}
