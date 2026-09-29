import { TaskDetailView } from "@/src/client/components/tasks/TaskDetailView";

export default async function ClientTaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  return <TaskDetailView taskId={taskId} />;
}
