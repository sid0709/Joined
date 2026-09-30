import { Suspense } from "react";

import { WorkView } from "@/src/candidate/components/WorkView";

export default function Page() {
  return (
    <Suspense>
      <WorkView />
    </Suspense>
  );
}
