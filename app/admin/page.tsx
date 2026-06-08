import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/current-user";
import { loadStageDefaultTaskRows, type StageDefaultTaskRow } from "@/lib/data";
import { STAGES, STAGE_TEAM } from "@/lib/stages";
import { AdminBoard, type AdminStage } from "./AdminBoard";

export const metadata = { title: "Admin — Unit Turns" };

export default async function AdminPage() {
  const profile = await getCurrentProfile();

  // proxy.ts guarantees we're authenticated here; the page enforces admin.
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const rows = await loadStageDefaultTaskRows();

  // Group rows under their phase (stage_idx position in STAGES).
  const stages: AdminStage[] = STAGES.map((s, idx) => ({
    stageIdx: idx,
    name: s.name,
    color: s.color,
    team: STAGE_TEAM[idx],
    tasks: rows
      .filter((r: StageDefaultTaskRow) => r.stage_idx === idx)
      .sort((a, b) => a.sort_order - b.sort_order),
  }));

  return <AdminBoard stages={stages} />;
}
