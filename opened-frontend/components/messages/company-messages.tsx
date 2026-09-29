"use client";

import { MessageInbox } from "@/components/messages/message-inbox";
import { fetchCompanyThread, sendCompanyMessage } from "@/lib/me/pipeline";
import { COMPANY_MESSAGES_PAGE } from "@/lib/routes";
import type { MailThread } from "@/lib/messages";

export function CompanyMessages({ threads }: { threads: MailThread[] }) {
  return (
    <MessageInbox
      title={COMPANY_MESSAGES_PAGE.label}
      threads={threads}
      privacyNote="Only your hiring team and the candidate see these messages. Candidates never see your email."
      sendMessage={sendCompanyMessage}
      refreshThread={fetchCompanyThread}
    />
  );
}
