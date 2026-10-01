import { Suspense } from "react";
import { ListSkeleton } from "@/components/list-skeleton";
import { DirectJobQueue } from "@/components/trust/direct-job-queue";

export const metadata = { title: "Direct review" };

export default function DirectReviewPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <DirectJobQueue />
    </Suspense>
  );
}
