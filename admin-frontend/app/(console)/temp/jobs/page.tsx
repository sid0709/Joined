import { Suspense } from "react";
import { ListSkeleton } from "@/components/list-skeleton";
import { JobMigration } from "@/components/migration/job-migration";

export const metadata = {
  title: "Temp jobs",
};

export default function TempJobsPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <JobMigration />
    </Suspense>
  );
}
