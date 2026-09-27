import { Suspense } from "react";
import { SearchJobsBrowser } from "@/components/jobs/search-jobs-browser";

export const metadata = {
  title: "Jobs",
};

export default function JobsPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface" />}>
      <SearchJobsBrowser />
    </Suspense>
  );
}
