"use client";

import { useState } from "react";
import { Avatar, Badge, Button, Chat, ChatComposer, ChatMessage, EmptyState, Stack, TextArea } from "@/src/shared/marketplace-ui";
import { ChatMessage as ChatMessageRecord, ProposalRecord, ProposalReviewAction } from "@/src/shared/types/job-room";

interface ApplicantChatProps {
  proposal: ProposalRecord | undefined;
  messages: ChatMessageRecord[];
  clientNote?: string;
  onReview: (action: ProposalReviewAction) => void;
  onSaveNote: (note: string) => void;
  onSendMessage: (text: string) => void;
  onApprove: () => void;
}

function initialsFor(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export function ApplicantChat({ proposal, messages, clientNote = "", onReview, onSaveNote, onSendMessage, onApprove }: ApplicantChatProps) {
  const [draft, setDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState(clientNote);

  if (!proposal) {
    return <EmptyState title="Select an applicant" description="Open an applicant to review their cover letter and start a conversation." />;
  }

  const send = () => {
    if (!draft.trim()) return;
    onSendMessage(draft.trim());
    setDraft("");
  };

  return (
    <Stack gap={20} className="marketplace-applicant-detail">
      <div className="marketplace-applicant-profile">
        <div className="marketplace-applicant-identity">
          <Avatar initials={initialsFor(proposal.candidateName)} size={48} />
          <div>
            <span className="label text-primary">APPLICANT</span>
            <h3 className="h2">{proposal.candidateName}</h3>
            <p className="caption text-ink-muted">{proposal.candidateTitle}</p>
          </div>
        </div>
        <div className="marketplace-applicant-badges">
          <Badge label={proposal.candidateRate} tone="primary" />
          <Badge label={proposal.status} tone={proposal.status === "Approved" ? "success" : "neutral"} />
        </div>
      </div>
      <div className="marketplace-applicant-facts">
        <div><span>Proposed rate</span><strong>{proposal.candidateRate}</strong></div>
        <div><span>Timeline</span><strong>{proposal.estimatedTimelineText}</strong></div>
        <div><span>Availability</span><strong>{proposal.availabilityText}</strong></div>
        <div><span>Application status</span><strong>{proposal.status}</strong></div>
      </div>
      <section className="marketplace-proposal-section">
        <span className="label text-primary">PROPOSAL NOTE</span>
        <p className="body marketplace-cover-letter">&ldquo;{proposal.coverLetterText}&rdquo;</p>
      </section>
      <div className="marketplace-proposal-detail-grid">
        <section>
          <span className="label text-primary">MILESTONES</span>
          <div className="marketplace-proposal-list">
            {proposal.milestones.map((milestone) => <div key={milestone.id}><strong className="body-strong">{milestone.title}</strong><span className="caption text-ink-muted">{milestone.amountText} · {milestone.dueDate}</span><span className="body-sm text-ink-muted">{milestone.deliverable}</span></div>)}
          </div>
        </section>
        <section>
          <span className="label text-primary">RELEVANT WORK</span>
          <div className="marketplace-proposal-list">
            {proposal.workExamples.length ? proposal.workExamples.map((example) => <div key={example.id}><strong className="body-strong">{example.title}</strong><span className="caption text-ink-muted">{example.url || "Link not provided"}</span><span className="body-sm text-ink-muted">{example.summary}</span></div>) : <p className="body-sm text-ink-muted">No work examples attached.</p>}
          </div>
        </section>
      </div>
      <section className="marketplace-conversation-section">
        <div className="marketplace-section-heading">
          <div><span className="label text-primary">CONVERSATION</span><h3 className="h2">Talk with {proposal.candidateName.split(" ")[0]}</h3></div>
          <span className="caption text-ink-muted">Private to this room</span>
        </div>
        <div className="marketplace-chat-surface">
          <Chat>
            {messages.length ? messages.map((message, index) => (
              <ChatMessage
                key={`${message.timestamp}-${index}`}
                author={message.senderRole === "Client" ? "You" : proposal.candidateName}
                initials={message.senderRole === "Client" ? "CL" : initialsFor(proposal.candidateName)}
                body={message.text}
                own={message.senderRole === "Client"}
                time={message.timestamp}
              />
            )) : (
              <EmptyState title="Start the conversation" description="Ask about their approach, availability, or milestones." />
            )}
          </Chat>
          <ChatComposer value={draft} onChange={setDraft} onSend={send} placeholder="Write a response to the applicant" />
        </div>
      </section>
      <section className="marketplace-proposal-section">
        <span className="label text-primary">PRIVATE CLIENT NOTES</span>
        <TextArea label="Decision notes" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Capture why this candidate is a fit, questions to follow up on, or decision context." />
        <Button type="button" variant="secondary" size="sm" onClick={() => onSaveNote(noteDraft)}>Save note</Button>
      </section>
      <div className="marketplace-applicant-actions">
        {proposal.status !== "Approved" ? (
          <>
            <Button type="button" variant="primary" onClick={onApprove}>Approve and hire</Button>
            <Button type="button" variant="secondary" onClick={() => onReview(proposal.status === "Shortlisted" ? "restore" : "shortlist")}>
              {proposal.status === "Shortlisted" ? "Remove shortlist" : "Shortlist"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => onReview("invite")}>Invite to next round</Button>
            {proposal.status !== "Rejected" && <Button type="button" variant="ghost" onClick={() => onReview("reject")}>Reject</Button>}
          </>
        ) : (
          <Button type="button" variant="ghost" disabled>Approved</Button>
        )}
      </div>
      <span className="caption text-ink-muted">Approval moves this room into Managed Work. Shortlist, notes, and invitations stay on the room for auditability.</span>
    </Stack>
  );
}
