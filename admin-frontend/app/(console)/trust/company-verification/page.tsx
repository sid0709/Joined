import { Suspense } from "react";
import { ListSkeleton } from "@/components/list-skeleton";
import { CompanyCaseQueue } from "@/components/trust/case-queue";

export const metadata = { title: "Company claims" };

export default function CompanyVerificationPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <CompanyCaseQueue />
    </Suspense>
  );
}
