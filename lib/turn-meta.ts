import { STAGES } from "@/lib/stages";
import type { Turn } from "@/lib/supabase/types";

export type TurnMeta = {
  daysInStage: number;
  isOverdue: boolean;
};

/** Whole-day diff between today and a timestamp. */
function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - then) / (1000 * 60 * 60 * 24)));
}

/** today > target_date AND turn isn't Ready */
function pastTarget(targetDate: string): boolean {
  if (!targetDate) return false;
  const target = new Date(targetDate + "T23:59:59");
  return Date.now() > target.getTime();
}

export function computeTurnMeta(turn: Turn): TurnMeta {
  const isReady = turn.stage_idx === STAGES.length - 1;
  return {
    daysInStage: daysSince(turn.stage_entered_at),
    isOverdue: !isReady && pastTarget(turn.target_date),
  };
}

export function computeMetaMap(turns: Turn[]): Record<string, TurnMeta> {
  const out: Record<string, TurnMeta> = {};
  for (const t of turns) out[t.id] = computeTurnMeta(t);
  return out;
}
