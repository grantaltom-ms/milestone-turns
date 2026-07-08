import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/current-user";
import { loadAllUserBuildingAccess, loadProfiles, loadProperties } from "@/lib/data";
import { AccessBoard } from "./AccessBoard";

export const metadata = { title: "Building Access — Admin" };

export default async function AccessPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const [users, buildings, access] = await Promise.all([
    loadProfiles(),
    loadProperties(),
    loadAllUserBuildingAccess(),
  ]);

  return <AccessBoard users={users} buildings={buildings} access={access} />;
}
