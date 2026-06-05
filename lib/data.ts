import { getServerSupabase } from "@/lib/supabase/server";
import type { Profile, PropertyRow, Task, TaskNote, Turn, TurnWithTasks } from "@/lib/supabase/types";
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
    .select("id, property_id, unit, stage_idx, vacate_date, target_date, assignee, created_at, updated_at")
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
      .select("id, property_id, unit, stage_idx, vacate_date, target_date, assignee, created_at, updated_at")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("turn_tasks")
      .select("id, turn_id, name, assignee, done, sort_order")
      .eq("turn_id", id)
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

export async function loadTaskCounts(): Promise<Map<string, { open: number; total: number }>> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("turn_tasks")
    .select("turn_id, done");
  if (error) throw error;
  const map = new Map<string, { open: number; total: number }>();
  for (const row of data ?? []) {
    const cur = map.get(row.turn_id) ?? { open: 0, total: 0 };
    cur.total += 1;
    if (!row.done) cur.open += 1;
    map.set(row.turn_id, cur);
  }
  return map;
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

/** Load all task notes for a specific turn + stage. */
export async function loadTaskNotes(turnId: string, stageIdx: number): Promise<TaskNote[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("task_notes")
    .select("id, turn_id, stage_idx, task_name, author_id, content, created_at, profiles(name)")
    .eq("turn_id", turnId)
    .eq("stage_idx", stageIdx)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown[]).map((row) => {
    const r = row as {
      id: string; turn_id: string; stage_idx: number; task_name: string;
      author_id: string; content: string; created_at: string;
      profiles: { name: string } | null;
    };
    return {
      id: r.id,
      turn_id: r.turn_id,
      stage_idx: r.stage_idx,
      task_name: r.task_name,
      author_id: r.author_id,
      author_name: r.profiles?.name ?? "Unknown",
      content: r.content,
      created_at: r.created_at,
    } satisfies TaskNote;
  });
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
