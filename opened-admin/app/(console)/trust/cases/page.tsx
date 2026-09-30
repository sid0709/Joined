import { Suspense } from "react";
import { ListSkeleton } from "@/components/list-skeleton";
import { ModerationCaseQueue } from "@/components/trust/moderation-queue";

export const metadata = { title: "Cases" };

export default function CasesPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <ModerationCaseQueue />
    </Suspense>
  );
}
