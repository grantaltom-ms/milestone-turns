import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/current-user";
import { loadProfiles } from "@/lib/data";
import { NotificationsBoard } from "./NotificationsBoard";

export const metadata = { title: "Slack Notifications — Admin" };

export default async function NotificationsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const users = await loadProfiles();

  return <NotificationsBoard users={users} />;
}
