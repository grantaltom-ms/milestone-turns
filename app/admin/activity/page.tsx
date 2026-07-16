import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/current-user";
import { loadGlobalActivity, loadProperties } from "@/lib/data";
import { ActivityFeedBoard } from "./ActivityFeedBoard";

export const metadata = { title: "Activity Feed — Admin" };

export default async function ActivityFeedPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const [events, buildings] = await Promise.all([
    loadGlobalActivity(),
    loadProperties(),
  ]);

  return <ActivityFeedBoard events={events} buildings={buildings} />;
}
