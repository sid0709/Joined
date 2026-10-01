"use client";

import { MessageInbox } from "@/components/messages/message-inbox";
import { fetchThread, sendThreadMessage } from "@/lib/me/pipeline";
import { MESSAGES_PAGE } from "@/lib/routes";
import type { MailThread } from "@/lib/messages";

export function CandidateMessages({ threads }: { threads: MailThread[] }) {
  return (
    <MessageInbox
      title={MESSAGES_PAGE.label}
      threads={threads}
      privacyNote="Only you and the company see these messages. Your email and phone stay private until you share them."
      sendMessage={sendThreadMessage}
      refreshThread={fetchThread}
    />
  );
}
