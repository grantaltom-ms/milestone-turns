import { notFound } from "next/navigation";
import { VacancyBoard } from "@/components/vacancy/VacancyBoard";
import { buildVacancyBoard, todayInSeattle } from "@/lib/vacancy-board";
import { loadLatestVacancySnapshot } from "@/lib/vacancy-data";
import { isValidVacancyCode } from "@/lib/vacancy-link";

// Read live on every visit: the snapshot refreshes daily and the page is
// behind a secret link, so there is nothing worth caching or prerendering.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Vacancies — Milestone Properties",
  // A secret-link page should never turn up in a search result.
  robots: { index: false, follow: false },
};

export default async function VacancyBoardPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  // A wrong or missing code is a 404, not a 403 — the page shouldn't confirm
  // that a vacancy board exists at this address at all.
  if (!isValidVacancyCode(code)) notFound();

  const { snapshotDate, rows } = await loadLatestVacancySnapshot();
  const board = buildVacancyBoard(rows, todayInSeattle());

  return <VacancyBoard board={board} asOf={snapshotDate} />;
}
