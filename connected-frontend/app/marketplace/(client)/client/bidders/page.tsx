import { Suspense } from "react";

import { BiddersView } from "@/src/client/components/bidders/BiddersView";

export default function ClientBiddersPage() {
  return (
    <Suspense>
      <BiddersView />
    </Suspense>
  );
}
