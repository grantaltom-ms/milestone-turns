export type Stage = { name: string; color: string };
export type Team = "office" | "maintenance";
export type Role = "office_lead" | "office" | "maintenance_lead" | "maintenance";

export const STAGES: readonly Stage[] = [
  { name: "Inspection", color: "#C8922A" }, // amber — office: walk the unit, scope work
  { name: "Materials",  color: "#697E94" }, // slate — office: order paint/parts
  { name: "Painting",   color: "#8B9BA9" }, // slate-light — maintenance
  { name: "Repairs",    color: "#8B4A2F" }, // brick — maintenance
  { name: "Cleaning",   color: "#4A7FA5" }, // steel — maintenance
  { name: "Ready",      color: "#3D7A5F" }, // moss — terminal
] as const;

// Which team owns each stage. Used to restrict the assignee picker on Detail.
export const STAGE_TEAM: readonly Team[] = [
  "office",       // 0 Inspection
  "office",       // 1 Materials
  "maintenance",  // 2 Painting
  "maintenance",  // 3 Repairs
  "maintenance",  // 4 Cleaning
  "maintenance",  // 5 Ready
] as const;

// Board filter category per stage. "Maintenance" deliberately excludes Ready
// — Ready is its own filter for finished units.
export type FilterCategory = "office" | "maintenance" | "ready";
export const STAGE_FILTER_CATEGORY: readonly FilterCategory[] = [
  "office",       // 0
  "office",       // 1
  "maintenance",  // 2
  "maintenance",  // 3
  "maintenance",  // 4
  "ready",        // 5
] as const;

export const DEFAULT_TASKS: readonly (readonly string[])[] = [
  ["Walk unit with inspector", "Document unit condition", "List all repairs needed", "Get vendor quotes", "Build scope of work"],
  ["Order paint", "Order replacement parts", "Order cleaning supplies", "Receive materials at unit"],
  ["Patch walls", "Prime", "Paint walls", "Paint trim", "Touch up"],
  ["Plumbing fixes", "Electrical fixes", "Replace fixtures", "Replace blinds", "Appliance check"],
  ["Deep clean kitchen", "Clean bathrooms", "Vacuum & mop floors", "Clean windows", "Remove all debris"],
  ["Final walkthrough", "Take marketing photos", "Update listing", "Confirm availability date"],
] as const;

export type TeamMember = { initials: string; name: string; role: Role; color: string };

// Single source of truth for the team. Swap placeholders → real names + roles
// when ready (and seed app_users accordingly).
export const TEAM_MEMBERS: readonly TeamMember[] = [
  { initials: "OS", name: "Office Staff",     role: "office_lead",      color: "#5BAE97" },
  { initials: "TZ", name: "TZ (placeholder)", role: "office",           color: "#2E6B5E" },
  { initials: "GR", name: "GR (placeholder)", role: "office",           color: "#C8922A" },
  { initials: "JA", name: "JA (placeholder)", role: "maintenance_lead", color: "#4A7FA5" },
  { initials: "AR", name: "AR (placeholder)", role: "maintenance",      color: "#8B4A2F" },
  { initials: "MB", name: "MB (placeholder)", role: "maintenance",      color: "#697E94" },
  { initials: "PL", name: "PL (placeholder)", role: "maintenance",      color: "#3D7A5F" },
] as const;

export const TEAM: readonly string[] = TEAM_MEMBERS.map((m) => m.initials);

export const AVATAR_COLORS: Record<string, string> = Object.fromEntries(
  TEAM_MEMBERS.map((m) => [m.initials, m.color]),
);

export function avatarColor(initials: string): string {
  return AVATAR_COLORS[initials] ?? "#1A2E44";
}

export function teamOf(initials: string): Team | null {
  const m = TEAM_MEMBERS.find((x) => x.initials === initials);
  if (!m) return null;
  return m.role.startsWith("office") ? "office" : "maintenance";
}

export function membersOnTeam(team: Team): TeamMember[] {
  return TEAM_MEMBERS.filter((m) => (m.role.startsWith("office") ? "office" : "maintenance") === team);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [, m, d] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(m) - 1]} ${Number(d)}`;
}
