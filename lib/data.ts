import { getServerSupabase } from "@/lib/supabase/server";
import type { DashboardStats, Profile, PropertyRow, Task, TaskNote, Turn, TurnWithTasks } from "@/lib/supabase/types";
import type { ProfileMember } from "@/lib/stages";

async function fetchPropertyNames(ids: number[]): Promise<Map<number, string>> {
  if (ids.length === 0) return new Map();
  const supabase = await getServerSupabase();
  const unique = Array.from(new Set(ids));
  const { data, error } = await supabase
    .from("properties")
    .select("id, name")
    .in("id", unique);
  if (error) throw error;
  const map = new Map<number, string>();
  for (const row of data ?? []) map.set(row.id, row.name);
  return map;
}

export async function loadTurns(): Promise<Turn[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("turns")
    .select("id, property_id, unit, stage_idx, vacate_date, target_date, assignee, stage_entered_at, created_at, updated_at, hold_status, hold_reason, held_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as Omit<Turn, "property_name">[];
  const names = await fetchPropertyNames(rows.map((r) => r.property_id));
  return rows.map((r) => ({ ...r, property_name: names.get(r.property_id) }));
}

export async function loadTurnWithTasks(id: string): Promise<TurnWithTasks | null> {
  const supabase = await getServerSupabase();
  const [{ data: turn, error: tErr }, { data: tasks, error: kErr }] = await Promise.all([
    supabase
      .from("turns")
      .select("id, property_id, unit, stage_idx, vacate_date, target_date, assignee, stage_entered_at, created_at, updated_at, hold_status, hold_reason, held_at")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("turn_tasks")
      .select("id, turn_id, name, assignee, done, sort_order, stage_idx, done_at, completed_by")
      .eq("turn_id", id)
      .order("stage_idx", { ascending: true })
      .order("sort_order", { ascending: true }),
  ]);
  if (tErr) throw tErr;
  if (kErr) throw kErr;
  if (!turn) return null;
  const names = await fetchPropertyNames([(turn as Turn).property_id]);
  return {
    ...(turn as Omit<Turn, "property_name">),
    property_name: names.get((turn as Turn).property_id),
    tasks: (tasks ?? []) as Task[],
  };
}

// Open + total tasks counts per turn, scoped to the turn's CURRENT stage.
export async function loadTaskCounts(): Promise<Map<string, { open: number; total: number }>> {
  const supabase = await getServerSupabase();
  const [{ data: turns, error: tErr }, { data: tasks, error: kErr }] = await Promise.all([
    supabase.from("turns").select("id, stage_idx"),
    supabase.from("turn_tasks").select("turn_id, stage_idx, done"),
  ]);
  if (tErr) throw tErr;
  if (kErr) throw kErr;
  const currentStageByTurn = new Map<string, number>();
  for (const t of turns ?? []) currentStageByTurn.set(t.id, t.stage_idx);
  const map = new Map<string, { open: number; total: number }>();
  for (const row of tasks ?? []) {
    if (currentStageByTurn.get(row.turn_id) !== row.stage_idx) continue;
    const cur = map.get(row.turn_id) ?? { open: 0, total: 0 };
    cur.total += 1;
    if (!row.done) cur.open += 1;
    map.set(row.turn_id, cur);
  }
  return map;
}

/** Set of turn IDs the given user "owns". */
export async function loadMineSet(initials: string): Promise<Set<string>> {
  const supabase = await getServerSupabase();
  const [{ data: ownedTurns, error: oErr }, { data: turns, error: tErr }, { data: tasks, error: kErr }] = await Promise.all([
    supabase.from("turns").select("id").eq("assignee", initials),
    supabase.from("turns").select("id, stage_idx"),
    supabase.from("turn_tasks").select("turn_id, stage_idx").eq("assignee", initials).eq("done", false),
  ]);
  if (oErr) throw oErr;
  if (tErr) throw tErr;
  if (kErr) throw kErr;
  const set = new Set<string>();
  for (const row of ownedTurns ?? []) set.add(row.id);
  const currentStage = new Map<string, number>();
  for (const t of turns ?? []) currentStage.set(t.id, t.stage_idx);
  for (const k of tasks ?? []) {
    if (currentStage.get(k.turn_id) === k.stage_idx) set.add(k.turn_id);
  }
  return set;
}

export async function loadProperties(): Promise<PropertyRow[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("properties")
    .select("id, name")
    .eq("is_group", false)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PropertyRow[];
}

/** Load all profiles as ProfileMember (for assignment pickers). */
export async function loadProfiles(): Promise<ProfileMember[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, role, initials, avatar_color")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProfileMember[];
}

/** Load task notes for a turn. Pass stageIdx to scope to one stage; omit for all stages. */
export async function loadTaskNotes(turnId: string, stageIdx?: number): Promise<TaskNote[]> {
  const supabase = await getServerSupabase();
  let q = supabase
    .from("task_notes")
    .select("id, turn_id, stage_idx, task_name, author_id, content, created_at, profiles(name)")
    .eq("turn_id", turnId);
  if (stageIdx !== undefined) q = q.eq("stage_idx", stageIdx);
  const { data, error } = await q.order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown[]).map((row) => {
    const r = row as {
      id: string; turn_id: string; stage_idx: number; task_name: string;
      author_id: string; content: string; created_at: string;
      profiles: { name: string } | null;
    };
    return {
      id: r.id, turn_id: r.turn_id, stage_idx: r.stage_idx, task_name: r.task_name,
      author_id: r.author_id, author_name: r.profiles?.name ?? "Unknown",
      content: r.content, created_at: r.created_at,
    } satisfies TaskNote;
  });
}

export type StageDefaultTask = { stage_idx: number; name: string; sort_order: number };

/** Same rows as StageDefaultTask but carrying the serial id (admin reorder/delete need it). */
export type StageDefaultTaskRow = StageDefaultTask & { id: number };

/** Admin loader: default tasks with their primary key, ordered for the admin board. */
export async function loadStageDefaultTaskRows(): Promise<StageDefaultTaskRow[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("stage_default_tasks")
    .select("id, stage_idx, name, sort_order")
    .order("stage_idx", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as StageDefaultTaskRow[];
}

/** Single source of truth for default checklists per stage. */
export async function loadStageDefaultTasks(stageIdx?: number): Promise<StageDefaultTask[]> {
  const supabase = await getServerSupabase();
  let q = supabase
    .from("stage_default_tasks")
    .select("stage_idx, name, sort_order")
    .order("stage_idx", { ascending: true })
    .order("sort_order", { ascending: true });
  if (stageIdx !== undefined) q = q.eq("stage_idx", stageIdx);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as StageDefaultTask[];
}

/** Returns only full Profile rows (used for displaying the current user). */
export async function loadProfileById(id: string): Promise<Profile | null> {
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("profiles")
    .select("id, name, email, role, initials, avatar_color, created_at")
    .eq("id", id)
    .maybeSingle();
  return data as Profile | null;
}

/** Whole-day diff between today (UTC) and a date string (YYYY-MM-DD). */
function daysSinceDate(iso: string): number {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const then = new Date(iso).getTime();
  const now = new Date(todayStr).getTime();
  return Math.max(0, Math.floor((now - then) / (1000 * 60 * 60 * 24)));
}

/** Compute portfolio-wide dashboard stats from a loaded turns array.
 *  Pure function — no DB calls. */
export function computeDashboardStats(turns: Turn[]): DashboardStats {
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const inTurnList = turns.filter((t) => t.stage_idx < 5);
  const inTurn = inTurnList.length;
  const overdue = inTurnList.filter((t) => t.target_date < todayStr).length;
  const onHold = turns.filter((t) => t.hold_status != null).length;
  const ready = turns.filter((t) => t.stage_idx === 5).length;

  const avgDays =
    inTurn === 0
      ? 0
      : Math.round(
          (inTurnList.reduce((sum, t) => sum + daysSinceDate(t.vacate_date), 0) / inTurn) * 10,
        ) / 10;

  return { inTurn, overdue, onHold, ready, avgDays };
}
