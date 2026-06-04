import { notFound } from "next/navigation";
import { Detail } from "@/components/detail/Detail";
import { loadTurnWithTasks } from "@/lib/data";

export default async function TurnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const turn = await loadTurnWithTasks(id);
  if (!turn) notFound();
  return <Detail turn={turn} />;
}
