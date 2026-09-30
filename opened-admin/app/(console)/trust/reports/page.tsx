import { Suspense } from "react";
import { ListSkeleton } from "@/components/list-skeleton";
import { ReportsQueue } from "@/components/trust/reports-queue";

export const metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <ReportsQueue />
    </Suspense>
  );
}
