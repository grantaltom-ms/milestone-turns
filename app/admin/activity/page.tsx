import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/current-user";
import { loadGlobalActivity } from "@/lib/data";
import { ActivityFeedBoard } from "./ActivityFeedBoard";

export const metadata = { title: "Activity Feed — Admin" };

export default async function ActivityFeedPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const events = await loadGlobalActivity();

  return <ActivityFeedBoard events={events} />;
}
