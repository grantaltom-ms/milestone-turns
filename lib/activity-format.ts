import { STAGES } from "@/lib/stages";
import type { useT } from "@/lib/i18n-context";
import type { TurnEvent } from "@/lib/supabase/types";

type TFns = ReturnType<typeof useT>;

export function relativeTime(iso: string, t: TFns["t"]): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return t("time.justNow");
  const m = Math.floor(s / 60);
  if (m < 60) return t("time.minsAgo", { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("time.hoursAgo", { n: h });
  const d = Math.floor(h / 24);
  if (d < 7) return t("time.daysAgo", { n: d });
  const w = Math.floor(d / 7);
  if (w < 5) return t("time.weeksAgo", { n: w });
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function describeEvent(event: TurnEvent, { t, stage }: TFns): string {
  const p = event.payload as Record<string, unknown> | null ?? {};
  const stageName = (idx: unknown) =>
    typeof idx === "number" && STAGES[idx] ? stage(idx) : String(idx);
  const taskName = (v: unknown) => (v == null ? t("activity.aTask") : String(v));

  switch (event.event_type) {
    case "created":
      return t("activity.created");
    case "advanced":
      return t("activity.advanced", { stage: stageName(p.to_stage) });
    case "handed_off":
      return p.assigned_to
        ? t("activity.handedOffTo", { stage: stageName(p.to_stage), who: String(p.assigned_to) })
        : t("activity.handedOff", { stage: stageName(p.to_stage) });
    case "held": {
      const label = p.hold_status === "blocked" ? t("activity.blockedLabel") : t("activity.heldLabel");
      return p.reason ? t("activity.withReason", { label, reason: String(p.reason) }) : label;
    }
    case "resumed":
      return t("activity.resumed");
    case "assigned":
      return t("activity.assigned", { who: p.assignee != null ? String(p.assignee) : "–" });
    case "task_assigned":
      return t("activity.taskAssigned", { task: p.task_name != null ? String(p.task_name) : t("activity.task"), who: p.assignee != null ? String(p.assignee) : "–" });
    case "edited": {
      const fields = Array.isArray(p.fields_changed) ? (p.fields_changed as string[]).join(", ") : "";
      return fields ? t("activity.edited", { fields }) : t("activity.editedDetails");
    }
    case "task_completed":
      return t("activity.taskCompleted", { task: taskName(p.task_name) });
    case "task_reopened":
      return t("activity.taskReopened", { task: taskName(p.task_name) });
    case "note_added":
      return t("activity.noteAdded", { task: taskName(p.task_name) });
    case "phase_skipped":
      return t("activity.phaseSkipped", { stage: stageName(p.stage) });
    case "phase_unskipped":
      return t("activity.phaseUnskipped", { stage: stageName(p.stage) });
    case "task_added":
      return t("activity.taskAdded", { task: taskName(p.task_name) });
    case "task_removed":
      return t("activity.taskRemoved", { task: taskName(p.task_name) });
    default:
      return event.event_type;
  }
}

const AVATAR_COLORS = [
  "#2E6B5E", "#1A2E44", "#C8922A", "#8B4A2F", "#5BAE97",
  "#697E94", "#3D7A5F", "#6B4226", "#A07840", "#2A5C46",
];

export function colorForInitials(initials: string): string {
  let hash = 0;
  for (const ch of initials) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
