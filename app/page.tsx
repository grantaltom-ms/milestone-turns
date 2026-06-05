import { redirect } from "next/navigation";
import { Board } from "@/components/board/Board";
import { loadTaskCounts, loadTurns } from "@/lib/data";
import { getCurrentProfile } from "@/lib/current-user";

export default async function HomePage() {
  const [turns, counts, currentUser] = await Promise.all([
    loadTurns(),
    loadTaskCounts(),
    getCurrentProfile(),
  ]);

  // Middleware should have redirected, but double-check here
  if (!currentUser) redirect("/login");

  const openCounts: Record<string, number> = {};
  for (const t of turns) openCounts[t.id] = counts.get(t.id)?.open ?? 0;

  return <Board turns={turns} openCounts={openCounts} currentUser={currentUser} />;
}
