import { redirect } from "next/navigation";
import { MyTasks } from "@/components/my-tasks/MyTasks";
import { getCurrentProfile } from "@/lib/current-user";
import { loadMyTasks } from "@/lib/data";

export const metadata = { title: "My Tasks — Unit Turns" };

export default async function MyTasksPage() {
  const currentUser = await getCurrentProfile();
  if (!currentUser) redirect("/login");

  const tasks = await loadMyTasks(currentUser.initials);

  return <MyTasks currentUser={currentUser} tasks={tasks} />;
}
