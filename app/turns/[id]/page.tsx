import { notFound, redirect } from "next/navigation";
import { Detail } from "@/components/detail/Detail";
import { LocaleProvider } from "@/lib/i18n-context";
import { loadProfiles, loadTaskNotes, loadTurnWithTasks } from "@/lib/data";
import { loadTurnEvents } from "@/lib/events";
import { getCurrentProfile } from "@/lib/current-user";
import { canSeeProperty, getVisiblePropertyIds } from "@/lib/access";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TurnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // A non-UUID id would otherwise reach the "id" column's query as a raw
  // Postgres type-cast error, crashing the page instead of a clean 404.
  if (!UUID_RE.test(id)) notFound();

  const [turn, currentUser] = await Promise.all([
    loadTurnWithTasks(id),
    getCurrentProfile(),
  ]);

  if (!currentUser) redirect("/login");
  if (!turn) notFound();

  // Block opening a turn in a building this user isn't allowed to see.
  const visible = await getVisiblePropertyIds(currentUser);
  if (!canSeeProperty(visible, turn.property_id)) notFound();

  const [profiles, initialNotes, initialEvents] = await Promise.all([
    loadProfiles(),
    loadTaskNotes(id), // all stages — Detail renders the full pipeline now
    loadTurnEvents(id, 50), // pre-load up to 50 for client-side pagination
  ]);

  return (
    <LocaleProvider locale={currentUser.language ?? "en"}>
      <Detail
        turn={turn}
        profiles={profiles}
        currentUser={currentUser}
        initialNotes={initialNotes}
        initialEvents={initialEvents}
      />
    </LocaleProvider>
  );
}
