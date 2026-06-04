export type Stage = { name: string; color: string };

export const STAGES: readonly Stage[] = [
  { name: "Inspection", color: "#C8922A" }, // amber — OS responsibility
  { name: "Materials",  color: "#697E94" }, // slate
  { name: "Painting",   color: "#8B9BA9" }, // slate-light
  { name: "Repairs",    color: "#8B4A2F" }, // brick
  { name: "Cleaning",   color: "#4A7FA5" }, // steel
  { name: "Ready",      color: "#3D7A5F" }, // moss — terminal
] as const;

export const DEFAULT_TASKS: readonly (readonly string[])[] = [
  ["Walk unit with inspector", "Document unit condition", "List all repairs needed", "Get vendor quotes", "Build scope of work"],
  ["Order paint", "Order replacement parts", "Order cleaning supplies", "Receive materials at unit"],
  ["Patch walls", "Prime", "Paint walls", "Paint trim", "Touch up"],
  ["Plumbing fixes", "Electrical fixes", "Replace fixtures", "Replace blinds", "Appliance check"],
  ["Deep clean kitchen", "Clean bathrooms", "Vacuum & mop floors", "Clean windows", "Remove all debris"],
  ["Final walkthrough", "Take marketing photos", "Update listing", "Confirm availability date"],
] as const;

export const TEAM = ["OS", "TZ", "JA", "GR", "AR", "MB", "PL"] as const;

export const AVATAR_COLORS: Record<string, string> = {
  OS: "#5BAE97", // mint — Office Staff
  TZ: "#2E6B5E",
  JA: "#4A7FA5",
  GR: "#C8922A",
  AR: "#8B4A2F",
  MB: "#697E94",
  PL: "#3D7A5F",
};

export function avatarColor(initials: string): string {
  return AVATAR_COLORS[initials] ?? "#1A2E44";
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(m) - 1]} ${Number(d)}`;
}
