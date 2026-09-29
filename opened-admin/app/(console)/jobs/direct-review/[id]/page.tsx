import { Suspense } from "react";
import { ListSkeleton } from "@/components/list-skeleton";
import { DirectJobDetail } from "@/components/trust/direct-job-detail";

export const metadata = { title: "Direct job review" };

export default async function DirectJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<ListSkeleton />}>
      <DirectJobDetail id={id} />
    </Suspense>
  );
}
