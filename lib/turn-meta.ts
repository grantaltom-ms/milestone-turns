import { STAGES } from "@/lib/stages";
import type { Turn } from "@/lib/supabase/types";

const STALE_DAYS = 7;

export type TurnMeta = {
  daysInStage: number;
  lastActivityAt: string;
  isStale: boolean;
};

/** Whole-day diff between today and a timestamp. */
function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - then) / (1000 * 60 * 60 * 24)));
}

export function computeTurnMeta(turn: Turn, lastActivity: Record<string, string>): TurnMeta {
  // Turns created outside the app's own action layer (e.g. the AppFolio sync
  // cron) may have no turn_events rows yet — fall back to created_at so they
  // still register as "active" rather than stale by default.
  const lastActivityAt = lastActivity[turn.id] ?? turn.created_at;
  return {
    daysInStage: daysSince(turn.stage_entered_at),
    lastActivityAt,
    isStale: turn.stage_idx < 5 && daysSince(lastActivityAt) >= STALE_DAYS,
  };
}

export function computeMetaMap(turns: Turn[], lastActivity: Record<string, string>): Record<string, TurnMeta> {
  const out: Record<string, TurnMeta> = {};
  for (const t of turns) out[t.id] = computeTurnMeta(t, lastActivity);
  return out;
}
