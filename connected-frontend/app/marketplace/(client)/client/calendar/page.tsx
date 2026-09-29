import { Suspense } from "react";

import { InterviewsView } from "@/src/client/components/interviews/InterviewsView";

export default function ClientInterviewsPage() {
  return (
    <Suspense>
      <InterviewsView />
    </Suspense>
  );
}
