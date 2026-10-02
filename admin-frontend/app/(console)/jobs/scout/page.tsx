import { Suspense } from "react";
import { ListSkeleton } from "@/components/list-skeleton";
import { TempJobsBrowser } from "@/components/jobs/temp-jobs-browser";
import { SCOUT_TEMP_JOBS_PATH } from "@/lib/jobs";
import { ROUTES } from "@/lib/nav";

export const metadata = {
  title: "Scout jobs",
};

export default function ScoutJobsPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <TempJobsBrowser
        title="Scout jobs"
        description="Submissions waiting here. Analyze them to add them to Jobs."
        listPath={SCOUT_TEMP_JOBS_PATH}
        route={ROUTES.scoutJobs}
        analyzePath={`${SCOUT_TEMP_JOBS_PATH}/analyze`}
        details={false}
        searchLabel="Search scout jobs"
        caption="Scout jobs"
        emptyTitle="No scout jobs yet"
        emptyDescription="They appear here when a scout submits a job."
      />
    </Suspense>
  );
}
