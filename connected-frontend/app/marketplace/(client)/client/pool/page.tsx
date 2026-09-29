import { Suspense } from "react";

import { PoolView } from "@/src/client/components/pool/PoolView";

export default function ClientPoolPage() {
  return (
    <Suspense>
      <PoolView />
    </Suspense>
  );
}
