import { Suspense } from "react";

import { MessagesView } from "@/src/client/components/messages/MessagesView";

export default function ClientMessagesPage() {
  return (
    <Suspense>
      <MessagesView />
    </Suspense>
  );
}
