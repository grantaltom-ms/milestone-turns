import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/current-user";
import {
  loadStageDefaultTaskRows,
  loadStageDisplayConfig,
  loadStageTaskTemplates,
  type StageDefaultTaskRow,
  type StageTaskTemplate,
} from "@/lib/data";
import { STAGES, STAGE_TEAM } from "@/lib/stages";
import { AdminBoard, type AdminStage } from "./AdminBoard";

export const metadata = { title: "Admin — Unit Turns" };

export default async function AdminPage() {
  const profile = await getCurrentProfile();

  // proxy.ts guarantees we're authenticated here; the page enforces admin.
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const [rows, displayConfig, templates] = await Promise.all([
    loadStageDefaultTaskRows(),
    loadStageDisplayConfig(),
    loadStageTaskTemplates(),
  ]);

  // Display order is keyed by stage_idx; fall back to stage_idx if unset.
  const orderByIdx = new Map<number, number>(displayConfig.map((c) => [c.stage_idx, c.display_order]));

  // Build one card per phase (stage_idx position in STAGES) ...
  const stages: AdminStage[] = STAGES.map((s, idx) => ({
    stageIdx: idx,
    name: s.name,
    color: s.color,
    team: STAGE_TEAM[idx],
    displayOrder: orderByIdx.get(idx) ?? idx,
    tasks: rows
      .filter((r: StageDefaultTaskRow) => r.stage_idx === idx)
      .sort((a, b) => a.sort_order - b.sort_order),
    templates: templates
      .filter((t: StageTaskTemplate) => t.stage_idx === idx)
      .map((t) => ({ id: t.id, name: t.name, itemCount: t.items.length })),
  }));

  // ... then list them in the admin's chosen display order.
  stages.sort((a, b) => a.displayOrder - b.displayOrder);

  return <AdminBoard stages={stages} />;
}
