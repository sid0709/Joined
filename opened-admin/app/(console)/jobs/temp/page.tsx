import { Suspense } from "react";
import { TempJobsBrowser } from "@/components/jobs/temp-jobs-browser";

export const metadata = {
  title: "Temp jobs",
};

export default function TempJobsPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface" />}>
      <TempJobsBrowser />
    </Suspense>
  );
}
