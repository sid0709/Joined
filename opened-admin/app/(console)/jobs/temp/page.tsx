import { Suspense } from "react";
import { ListSkeleton } from "@/components/list-skeleton";
import { TempJobsBrowser } from "@/components/jobs/temp-jobs-browser";

export const metadata = {
  title: "Temp jobs",
};

export default function TempJobsPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <TempJobsBrowser />
    </Suspense>
  );
}
