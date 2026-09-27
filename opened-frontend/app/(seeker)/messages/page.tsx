import type { Metadata } from "next";
import { Stack } from "@openseat/design-system";
import { MessageInbox } from "@/components/message-inbox";
import { PageHeader } from "@/components/page-header";
import { THREADS } from "@/lib/account";

export const metadata: Metadata = {
  title: "Messages",
  description: "Threads with companies and Opened.",
};

export default function MessagesPage() {
  return (
    <Stack gap={5}>
      <PageHeader
        title="Messages"
        description="Companies, and notes from Opened. Replies stay on this page."
      />
      <MessageInbox threads={THREADS} />
    </Stack>
  );
}
