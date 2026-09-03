export type Stage = { name: string; color: string };
export type Team = "office" | "maintenance";
export type Role = "office_lead" | "office" | "maintenance_lead" | "maintenance" | "admin" | "vendor";

export const STAGES: readonly Stage[] = [
  { name: "Inspection",             color: "#C8922A" },
  { name: "Maintenance & Materials", color: "#8B4A2F" },
  { name: "Cleaning",               color: "#4A7FA5" },
  { name: "Ready",                  color: "#3D7A5F" },
] as const;

export const STAGE_TEAM: readonly Team[] = [
  "office",
  "maintenance",
  "maintenance",
  "maintenance",
] as const;

// Stages whose assignee picker draws from more than one team. Falls back to
// [STAGE_TEAM[idx]] when a stage isn't listed here. Maintenance & Materials
// is shared by managers (office) and maintenance — vendors land here too via
// teamOfRole's fallback bucket.
export const STAGE_ASSIGNABLE_TEAMS: readonly (readonly Team[])[] = [
  ["office"],
  ["office", "maintenance"],
  ["maintenance"],
  ["maintenance"],
] as const;

export type FilterCategory = "office" | "maintenance" | "ready";
export const STAGE_FILTER_CATEGORY: readonly FilterCategory[] = [
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

/** Members assignable to tasks in a given stage — draws from every team
 *  listed for that stage in STAGE_ASSIGNABLE_TEAMS (falls back to the
 *  stage's single primary team). */
export function membersAssignableInStage(stageIdx: number, profiles: ProfileMember[]): ProfileMember[] {
  const teams = STAGE_ASSIGNABLE_TEAMS[stageIdx] ?? [STAGE_TEAM[stageIdx]];
  return profiles.filter((p) => p.assignable_all_phases || teams.includes(teamOfRole(p.role)));
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
