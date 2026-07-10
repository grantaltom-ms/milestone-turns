export type HoldStatus = "on_hold" | "blocked";

export type Locale = "en" | "es";

export type Turn = {
  id: string;
  property_id: number;
  property_name?: string;
  unit: string;
  stage_idx: number;
  vacate_date: string;
  target_date: string;
  assignee: string;
  stage_entered_at: string;
  created_at: string;
  updated_at: string;
  hold_status: HoldStatus | null;
  hold_reason: string | null;
  held_at: string | null;
  // stage_idx values skipped on this turn (display-only / advance bypass)
  skipped_phases: number[];
  // AppFolio-sourced: scheduled move-in date for the unit's next tenant.
  // Set once the unit is leased (AppFolio status "Vacant-Rented"); null otherwise.
  next_move_in: string | null;
};

export type Task = {
  id: string;
  turn_id: string;
  name: string;
  assignee: string;
  done: boolean;
  sort_order: number;
  stage_idx: number;
  done_at: string | null;
  completed_by: string | null;
  // one-off task added for this turn (vs. seeded from defaults)
  is_custom: boolean;
};

export type TurnWithTasks = Turn & { tasks: Task[] };

export type PropertyRow = { id: number; name: string };

export type AppUser = { user_id: string; initials: string; name: string };

export type Profile = {
  id: string;
  name: string;
  email: string;
  role: "office_lead" | "office" | "maintenance_lead" | "maintenance" | "admin";
  initials: string;
  avatar_color: string;
  language: Locale;
  created_at: string;
};

export type TaskNote = {
  id: string;
  turn_id: string;
  stage_idx: number;
  task_name: string;
  author_id: string;
  author_name: string;
  content: string | null;
  photo_url: string | null;
  created_at: string;
};

export type TurnEventType =
  | "created"
  | "advanced"
  | "handed_off"
  | "held"
  | "resumed"
  | "assigned"
  | "task_assigned"
  | "edited"
  | "task_completed"
  | "task_reopened"
  | "note_added"
  | "reverted"
  | "phase_skipped"
  | "phase_unskipped"
  | "task_added"
  | "task_removed"
  | "created_from_appfolio";

export type TurnEvent = {
  id: string;
  turn_id: string;
  event_type: TurnEventType;
  actor: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

export type DashboardStats = {
  inTurn: number;
  overdue: number;
  ready: number;
  avgDays: number;
  moveInSoon: number;
};
