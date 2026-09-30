import { Suspense } from "react";

import { MessagesView } from "@/src/candidate/components/MessagesView";

export default function Page() {
  return (
    <Suspense>
      <MessagesView />
    </Suspense>
  );
}
