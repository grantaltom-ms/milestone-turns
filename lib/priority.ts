import type { Turn } from "@/lib/supabase/types";

// Rough make-ready effort, in days, to complete each stage's work.
// Indexed by stage_idx: Inspection, Materials, Painting, Repairs, Cleaning, Ready.
// Tunable — these are estimates used only to gauge "how much runway is left."
export const STAGE_WORK_DAYS = [1, 3, 4, 3, 1, 0];

const READY_STAGE = STAGE_WORK_DAYS.length - 1; // 5

export type UrgencyLevel = "none" | "tight" | "behind" | "overdue";

export type Urgency = {
  moveIn: string | null; // yyyy-mm-dd
  daysUntil: number | null; // whole days from today to move-in (negative = past)
  daysLeft: number; // estimated make-ready work days remaining
  slack: number | null; // daysUntil - daysLeft
  level: UrgencyLevel;
  behindBy: number; // positive number of days behind, for display
};

/** Whole days between two yyyy-mm-dd dates (b - a), computed in UTC so it is
 *  timezone- and DST-stable and matches on server and client. */
export function diffDays(aIso: string, bIso: string): number {
  const a = Date.UTC(+aIso.slice(0, 4), +aIso.slice(5, 7) - 1, +aIso.slice(8, 10));
  const b = Date.UTC(+bIso.slice(0, 4), +bIso.slice(5, 7) - 1, +bIso.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/** Estimated make-ready days remaining from the current stage through Ready,
 *  skipping any skipped phases. */
export function estimatedDaysLeft(stageIdx: number, skipped: Set<number>): number {
  let sum = 0;
  for (let i = stageIdx; i < READY_STAGE; i++) {
    if (skipped.has(i)) continue;
    sum += STAGE_WORK_DAYS[i] ?? 0;
  }
  return sum;
}

/**
 * Urgency of a turn relative to its move-in date. Deliberately conservative:
 * only `behind` and `overdue` (and mildly `tight`) are "loud"; everything else
 * is `none` so the UI stays calm.
 */
export function computeUrgency(turn: Turn, todayIso: string): Urgency {
  const moveIn = turn.move_in_date ?? null;
  const base: Urgency = { moveIn, daysUntil: null, daysLeft: 0, slack: null, level: "none", behindBy: 0 };

  // Ready units and held units carry no move-in urgency.
  if (turn.stage_idx >= READY_STAGE || turn.hold_status != null || !moveIn) return base;

  const daysUntil = diffDays(todayIso, moveIn);
  const daysLeft = estimatedDaysLeft(turn.stage_idx, new Set(turn.skipped_phases ?? []));

  // Move-in already passed and the unit isn't Ready → overdue.
  if (daysUntil < 0) {
    return { moveIn, daysUntil, daysLeft, slack: daysUntil - daysLeft, level: "overdue", behindBy: -daysUntil };
  }

  const slack = daysUntil - daysLeft;
  const level: UrgencyLevel = slack < 0 ? "behind" : slack <= 2 ? "tight" : "none";
  return { moveIn, daysUntil, daysLeft, slack, level, behindBy: slack < 0 ? -slack : 0 };
}

/** True for turns that need attention now (behind schedule or past move-in). */
export function isAtRisk(u: Urgency): boolean {
  return u.level === "behind" || u.level === "overdue";
}

const RANK: Record<UrgencyLevel, number> = { overdue: 0, behind: 1, tight: 2, none: 3 };

/** Sort comparator: most urgent first; then soonest move-in; stable-ish fallback. */
export function byUrgency(a: { u: Urgency }, b: { u: Urgency }): number {
  const r = RANK[a.u.level] - RANK[b.u.level];
  if (r !== 0) return r;
  if (a.u.moveIn && b.u.moveIn && a.u.moveIn !== b.u.moveIn) return a.u.moveIn < b.u.moveIn ? -1 : 1;
  if (a.u.moveIn && !b.u.moveIn) return -1;
  if (!a.u.moveIn && b.u.moveIn) return 1;
  return 0;
}
