import { Suspense } from "react";
import { ListSkeleton } from "@/components/list-skeleton";
import { SearchJobsBrowser } from "@/components/jobs/search-jobs-browser";

export const metadata = {
  title: "Jobs",
};

export default function JobsPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <SearchJobsBrowser />
    </Suspense>
  );
}
