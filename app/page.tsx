import { Board } from "@/components/board/Board";
import { loadTaskCounts, loadTurns } from "@/lib/data";

export default async function HomePage() {
  const [turns, counts] = await Promise.all([loadTurns(), loadTaskCounts()]);
  const openCounts: Record<string, number> = {};
  for (const t of turns) openCounts[t.id] = counts.get(t.id)?.open ?? 0;
  return <Board turns={turns} openCounts={openCounts} />;
}
