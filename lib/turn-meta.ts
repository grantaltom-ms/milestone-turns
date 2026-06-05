import { STAGES } from "@/lib/stages";
import type { Turn } from "@/lib/supabase/types";

export type TurnMeta = {
  daysInStage: number;
};

/** Whole-day diff between today and a timestamp. */
function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - then) / (1000 * 60 * 60 * 24)));
}

export function computeTurnMeta(turn: Turn): TurnMeta {
  return { daysInStage: daysSince(turn.stage_entered_at) };
}

export function computeMetaMap(turns: Turn[]): Record<string, TurnMeta> {
  const out: Record<string, TurnMeta> = {};
  for (const t of turns) out[t.id] = computeTurnMeta(t);
  return out;
}
