import { Suspense } from "react";
import { ListSkeleton } from "@/components/list-skeleton";
import { ReportDetail } from "@/components/trust/report-detail";

export const metadata = { title: "Report" };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<ListSkeleton />}>
      <ReportDetail id={id} />
    </Suspense>
  );
}
