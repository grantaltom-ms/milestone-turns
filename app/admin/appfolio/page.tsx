import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/current-user";
import { loadAppfolioSyncSettings } from "@/lib/data";
import { AppfolioSettings } from "./AppfolioSettings";

export const metadata = { title: "AppFolio Sync — Unit Turns Admin" };

export default async function AppfolioSyncPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const settings = await loadAppfolioSyncSettings();
  return <AppfolioSettings settings={settings} />;
}
