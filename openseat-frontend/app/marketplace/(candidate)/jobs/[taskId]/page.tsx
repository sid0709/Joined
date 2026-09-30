import { BidderTaskDetailView } from "@/src/candidate/components/BidderWorkflowView";

export default async function BidderTaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  return <BidderTaskDetailView taskId={taskId} />;
}
