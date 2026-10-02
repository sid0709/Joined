import { Suspense } from "react";
import { ListSkeleton } from "@/components/list-skeleton";
import { JobMigration } from "@/components/migration/job-migration";

export const metadata = {
  title: "Job migration",
};

export default function JobMigrationPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <JobMigration />
    </Suspense>
  );
}
