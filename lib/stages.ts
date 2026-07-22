export type Stage = { name: string; color: string };
export type Team = "office" | "maintenance";
export type Role = "office_lead" | "office" | "maintenance_lead" | "maintenance";

export const STAGES: readonly Stage[] = [
  { name: "Inspection",         color: "#C8922A" },
  { name: "Materials",          color: "#697E94" },
  { name: "Maintenance Repairs", color: "#8B4A2F" },
  { name: "Cleaning",           color: "#4A7FA5" },
  { name: "Ready",              color: "#3D7A5F" },
] as const;

export const STAGE_TEAM: readonly Team[] = [
  "office",
  "office",
  "maintenance",
  "maintenance",
  "maintenance",
] as const;

export type FilterCategory = "office" | "maintenance" | "ready";
export const STAGE_FILTER_CATEGORY: readonly FilterCategory[] = [
  "office",
  "office",
  "maintenance",
  "maintenance",
  "ready",
] as const;

// ProfileMember: the runtime shape used in assignment pickers (sourced from DB)
export type ProfileMember = {
  id: string;
  initials: string;
  name: string;
  role: Role;
  avatar_color: string;
  slack_user_id: string | null;
  assignable_all_phases: boolean;
};

export function teamOfRole(role: Role): Team {
  return role.startsWith("office") ? "office" : "maintenance";
}

export function membersOnTeam(team: Team, profiles: ProfileMember[]): ProfileMember[] {
  return profiles.filter((p) => p.assignable_all_phases || teamOfRole(p.role) === team);
}

export function avatarColorFromProfiles(initials: string, profiles: ProfileMember[]): string {
  return profiles.find((p) => p.initials === initials)?.avatar_color ?? "#697E94";
}

// Kept for legacy call-sites that don't yet have profiles; returns neutral grey
export function avatarColor(initials: string, profiles?: ProfileMember[]): string {
  if (profiles) return avatarColorFromProfiles(initials, profiles);
  return "#697E94";
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [, m, d] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[Number(m) - 1]} ${Number(d)}`;
}
