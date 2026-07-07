import { redirect } from "next/navigation";
import { Board } from "@/components/board/Board";
import { LocaleProvider } from "@/lib/i18n-context";
import { getCurrentProfile } from "@/lib/current-user";
import { computeDashboardStats, loadMineSet, loadProfiles, loadTaskCounts, loadTurns } from "@/lib/data";
import { computeMetaMap } from "@/lib/turn-meta";

export default async function HomePage() {
  const [turns, counts, currentUser] = await Promise.all([
    loadTurns(),
    loadTaskCounts(),
    getCurrentProfile(),
  ]);

  if (!currentUser) redirect("/login");

  const [profiles, mineSet] = await Promise.all([
    loadProfiles(),
    loadMineSet(currentUser.initials),
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
        meta={computeMetaMap(turns)}
        stats={stats}
      />
    </LocaleProvider>
  );
}
