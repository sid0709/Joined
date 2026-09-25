"use client";

import { useState } from "react";
import { Badge, Button, Chat, ChatComposer, ChatMessage, EmptyState, Stack } from "@openseat/design-system";
import { ChatMessage as ChatMessageRecord, ProposalRecord } from "@/src/shared/types/job-room";

interface ApplicantChatProps {
  proposal: ProposalRecord | undefined;
  messages: ChatMessageRecord[];
  onSendMessage: (text: string) => void;
  onApprove: () => void;
}

export function ApplicantChat({ proposal, messages, onSendMessage, onApprove }: ApplicantChatProps) {
  const [draft, setDraft] = useState("");

  if (!proposal) {
    return <EmptyState title="Select an applicant" description="Open an applicant to review their cover letter and start a conversation." />;
  }

  const send = () => {
    if (!draft.trim()) return;
    onSendMessage(draft.trim());
    setDraft("");
  };

  return (
    <Stack gap={16} className="marketplace-applicant-chat">
      <div className="marketplace-applicant-header">
        <div>
          <h3 className="h2">{proposal.candidateName}</h3>
          <p className="caption text-ink-muted">{proposal.candidateTitle}</p>
        </div>
        <Badge label={proposal.candidateRate} tone="primary" />
      </div>
      <p className="body-sm marketplace-cover-letter">&ldquo;{proposal.coverLetterText}&rdquo;</p>
      <Chat>
        {messages.map((message, index) => (
          <ChatMessage
            key={`${message.timestamp}-${index}`}
            author={message.senderRole === "Client" ? "You" : proposal.candidateName}
            initials={message.senderRole === "Client" ? "CL" : proposal.candidateName.slice(0, 2).toUpperCase()}
            body={message.text}
            own={message.senderRole === "Client"}
            time={message.timestamp}
          />
        ))}
      </Chat>
      <ChatComposer value={draft} onChange={setDraft} onSend={send} placeholder="Write a response" />
      {proposal.status !== "Approved" ? (
        <Button type="button" variant="primary" onClick={onApprove}>Approve and hire</Button>
      ) : (
        <Button type="button" variant="ghost" disabled>Approved</Button>
      )}
    </Stack>
  );
}
