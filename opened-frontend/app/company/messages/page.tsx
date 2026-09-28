import type { Metadata } from "next";
import { Sticky } from "@openseat/design-system";
import { MessageInbox } from "@/components/messages/message-inbox";
import { CONTENT_PADDING } from "@/components/shell/app-frame";
import { COMPANY_THREADS } from "@/lib/company";
import { COMPANY_MESSAGES_PAGE } from "@/lib/routes";

export const metadata: Metadata = { title: "Company messages" };

export default function CompanyMessagesPage() {
  return (
    <Sticky fill offset={CONTENT_PADDING}>
      <MessageInbox
        title={COMPANY_MESSAGES_PAGE.label}
        threads={COMPANY_THREADS}
        privacyNote="Only your hiring team and the candidate see these messages. Candidates never see your email."
      />
    </Sticky>
  );
}
