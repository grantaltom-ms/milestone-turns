import { getServerSupabase } from "@/lib/supabase/server";
import type { TurnEventType } from "@/lib/supabase/types";

/**
 * Fire-and-forget event logger. Inserts one row into turn_events.
 * Errors are swallowed so they never break a user-facing action.
 */
export async function logEvent(
  turnId: string,
  eventType: TurnEventType,
  actor: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  try {
    const supabase = await getServerSupabase();
    await supabase.from("turn_events").insert({
      turn_id: turnId,
      event_type: eventType,
      actor,
      payload: payload ?? null,
    });
  } catch {
    // Logging must not break the action — silently ignore
  }
}

/**
 * Load the latest events for a turn. Returns them newest-first.
 */
export async function loadTurnEvents(
  turnId: string,
  limit = 25,
  offset = 0,
): Promise<import("@/lib/supabase/types").TurnEvent[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("turn_events")
    .select("id, turn_id, event_type, actor, payload, created_at")
    .eq("turn_id", turnId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []) as import("@/lib/supabase/types").TurnEvent[];
}
