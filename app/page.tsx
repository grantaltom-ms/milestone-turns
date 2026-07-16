import { redirect } from "next/navigation";
import { Board } from "@/components/board/Board";
import { LocaleProvider } from "@/lib/i18n-context";
import { getCurrentProfile } from "@/lib/current-user";
import { getVisiblePropertyIds } from "@/lib/access";
import { computeDashboardStats, loadLastActivityMap, loadMineSet, loadProfiles, loadTaskCounts, loadTurns } from "@/lib/data";
import { computeMetaMap } from "@/lib/turn-meta";

export default async function HomePage() {
  const [allTurns, counts, currentUser] = await Promise.all([
    loadTurns(),
    loadTaskCounts(),
    getCurrentProfile(),
  ]);

  if (!currentUser) redirect("/login");

  // Restrict to the buildings this user is allowed to see (null = all).
  const visible = await getVisiblePropertyIds(currentUser);
  const turns = visible === null ? allTurns : allTurns.filter((t) => visible.includes(t.property_id));

  const [profiles, mineSet, lastActivity] = await Promise.all([
    loadProfiles(),
    loadMineSet(currentUser.initials),
    loadLastActivityMap(),
  ]);

  const openCounts: Record<string, number> = {};
  for (const t of turns) openCounts[t.id] = counts.get(t.id)?.open ?? 0;

  const stats = computeDashboardStats(turns);

  return (
    <LocaleProvider locale={currentUser.language ?? "en"}>
      <Board
        turns={turns}
        openCounts={openCounts}
        currentUser={currentUser}
        profiles={profiles}
        mineIds={Array.from(mineSet)}
        meta={computeMetaMap(turns, lastActivity)}
        stats={stats}
      />
    </LocaleProvider>
  );
}
