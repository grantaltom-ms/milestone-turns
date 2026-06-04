import { Board } from "@/components/board/Board";
import { getCurrentInitials } from "@/lib/current-user";
import { loadTaskCounts, loadTurns } from "@/lib/data";

export default async function HomePage() {
  const [turns, counts, meInitials] = await Promise.all([
    loadTurns(),
    loadTaskCounts(),
    getCurrentInitials(),
  ]);
  const openCounts: Record<string, number> = {};
  for (const t of turns) openCounts[t.id] = counts.get(t.id)?.open ?? 0;
  return <Board turns={turns} openCounts={openCounts} meInitials={meInitials} />;
}
