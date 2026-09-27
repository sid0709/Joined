import type { Metadata } from "next";
import { Stack } from "@openseat/design-system";
import { MessageInbox } from "@/components/message-inbox";
import { PageHeader } from "@/components/page-header";
import { COMPANY_THREADS } from "@/lib/company";
import { COMPANY_MESSAGES_PAGE } from "@/lib/routes";

export const metadata: Metadata = { title: "Company messages" };

export default function CompanyMessagesPage() {
  return (
    <Stack gap={6}>
      <PageHeader
        title={COMPANY_MESSAGES_PAGE.label}
        description={COMPANY_MESSAGES_PAGE.description}
      />
      <MessageInbox threads={COMPANY_THREADS} />
    </Stack>
  );
}
