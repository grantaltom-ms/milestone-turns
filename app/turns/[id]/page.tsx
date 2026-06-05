import { notFound, redirect } from "next/navigation";
import { Detail } from "@/components/detail/Detail";
import { loadProfiles, loadTaskNotes, loadTurnWithTasks } from "@/lib/data";
import { getCurrentProfile } from "@/lib/current-user";

export default async function TurnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [turn, currentUser] = await Promise.all([
    loadTurnWithTasks(id),
    getCurrentProfile(),
  ]);

  if (!currentUser) redirect("/login");
  if (!turn) notFound();

  const [profiles, initialNotes] = await Promise.all([
    loadProfiles(),
    loadTaskNotes(id), // all stages — Detail renders the full pipeline now
  ]);

  return (
    <Detail
      turn={turn}
      profiles={profiles}
      currentUser={currentUser}
      initialNotes={initialNotes}
    />
  );
}
