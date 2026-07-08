import { redirect } from "next/navigation";
import { MyTasks } from "@/components/my-tasks/MyTasks";
import { LocaleProvider } from "@/lib/i18n-context";
import { getCurrentProfile } from "@/lib/current-user";
import { getVisiblePropertyIds } from "@/lib/access";
import { loadMyTasks } from "@/lib/data";

export const metadata = { title: "My Tasks — Unit Turns" };

export default async function MyTasksPage() {
  const currentUser = await getCurrentProfile();
  if (!currentUser) redirect("/login");

  const visible = await getVisiblePropertyIds(currentUser);
  const tasks = await loadMyTasks(currentUser.initials, visible);

  return (
    <LocaleProvider locale={currentUser.language ?? "en"}>
      <MyTasks currentUser={currentUser} tasks={tasks} />
    </LocaleProvider>
  );
}
