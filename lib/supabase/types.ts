export type Turn = {
  id: string;
  property_id: number;
  property_name?: string;
  unit: string;
  stage_idx: number;
  vacate_date: string;
  target_date: string;
  assignee: string;
  created_at: string;
  updated_at: string;
};

export type Task = {
  id: string;
  turn_id: string;
  name: string;
  assignee: string;
  done: boolean;
  sort_order: number;
};

export type TurnWithTasks = Turn & { tasks: Task[] };

export type PropertyRow = { id: number; name: string };

export type AppUser = { user_id: string; initials: string; name: string };

export type Profile = {
  id: string;
  name: string;
  email: string;
  role: "office_lead" | "office" | "maintenance_lead" | "maintenance";
  initials: string;
  avatar_color: string;
  created_at: string;
};

export type TaskNote = {
  id: string;
  turn_id: string;
  stage_idx: number;
  task_name: string;
  author_id: string;
  author_name: string;
  content: string;
  created_at: string;
};
