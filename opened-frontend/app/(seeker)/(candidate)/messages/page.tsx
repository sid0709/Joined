import type { Metadata } from "next";
import { Sticky } from "@openseat/design-system";
import { MessageInbox } from "@/components/messages/message-inbox";
import { PageContainer } from "@/components/page-container";
import { CONTENT_PADDING } from "@/components/shell/app-frame";
import { THREADS } from "@/lib/account";
import { MESSAGES_PAGE } from "@/lib/routes";

export const metadata: Metadata = {
  title: MESSAGES_PAGE.label,
  description: MESSAGES_PAGE.description,
};

export default function MessagesPage() {
  return (
    <PageContainer width="wide">
      <Sticky fill offset={CONTENT_PADDING}>
        <MessageInbox
          title={MESSAGES_PAGE.label}
          threads={THREADS}
          privacyNote="Only you and the company see these messages. Your email and phone stay private until you share them."
        />
      </Sticky>
    </PageContainer>
  );
}
