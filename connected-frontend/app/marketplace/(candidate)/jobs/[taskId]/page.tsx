import { TaskDetailView } from "@/src/candidate/components/TaskDetailView";

export default async function BidderTaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  return <TaskDetailView taskId={taskId} />;
}
