"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, Chat, ChatComposer, ChatMessage, EmptyState, PageBody, Stack } from "@/src/shared/marketplace-ui";
import { useMockAuth } from "@/src/shared/auth/MockAuthContext";
import { useJobRoomsContext } from "@/src/shared/job-rooms/JobRoomsContext";

export default function MessagesPage() {
  const { currentUser } = useMockAuth();
  const { allRooms, applicationsRegistry, sendChatMessage } = useJobRoomsContext();
  const candidateId = currentUser?.email ?? "logged-in-user";
  const threads = allRooms.flatMap((room) => {
    const proposal = applicationsRegistry[room.id]?.proposals.find((item) => item.id === candidateId);
    return proposal ? [{ room, proposal, messages: applicationsRegistry[room.id]?.chatHistory[proposal.id] ?? [] }] : [];
  });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const selected = threads.find(({ room }) => room.id === selectedKey) ?? threads[0];

  const send = () => {
    if (!selected || !draft.trim()) return;
    sendChatMessage(selected.room.id, selected.proposal.id, "Candidate", draft.trim());
    setDraft("");
  };

  return (
    <PageBody>
      <Stack gap={24}>
        <div>
          <span className="label text-primary">CANDIDATE WORKSPACE</span>
          <h1 className="h1">Messages</h1>
          <p className="body text-ink-muted">Chat directly with job hunters after an invitation or job-room response. Every conversation stays connected to its brief and next step.</p>
        </div>
        <div className="marketplace-dashboard-stats"><Card><strong className="marketplace-dashboard-stat-value">{threads.length}</strong><span className="caption">Room conversations</span></Card><Card><strong className="marketplace-dashboard-stat-value">{threads.filter(({ proposal }) => proposal.status === "In Discussion").length}</strong><span className="caption">Deals in discussion</span></Card><Card><strong className="marketplace-dashboard-stat-value">{threads.filter(({ proposal }) => proposal.status === "Approved").length}</strong><span className="caption">Approved rooms</span></Card></div>
        {!threads.length ? (
          <div className="marketplace-message-layout">
            <Card title="Your conversation inbox" meta="Every conversation begins when a client approves your profile or responds to an assigned job link.">
              <div className="marketplace-selection-list">
                <div className="marketplace-selection-item marketplace-selection-item-active"><span><strong className="body-strong">No active room yet</strong><span className="caption text-ink-muted">Waiting for client contact</span></span><Badge label="Waiting" tone="neutral" /></div>
                <Button href="/marketplace/candidate/profile" variant="secondary">Review public profile</Button>
              </div>
            </Card>
            <Stack gap={16}>
              <Card title="Room notifications" meta="Updates will appear here beside the chat"><div className="marketplace-review-list"><div><strong className="body-strong">Profile discovery</strong><p className="body-sm text-ink-muted">A job hunter can find your bidder profile when your skills and performance match.</p></div><div><strong className="body-strong">Job assignment</strong><p className="body-sm text-ink-muted">An assigned job link unlocks the bid and room conversation.</p></div></div></Card>
              <Card title="Conversation preview" meta="The room will include proposal terms, scheduled events, files, and delivery history"><Chat><ChatMessage author="OpenSeat" initials="OS" body="Your bidder–job hunter conversations will appear here with the full job-room context." time="When assigned" /></Chat><p className="body-sm text-ink-muted">A scheduled interview or evaluation created by the job hunter will also be represented in this room.</p></Card>
              <Card title="What you can do here" meta="Messages is the negotiation workspace"><p className="body-sm">Clarify the brief, confirm rate and availability, agree milestones, respond to the job hunter’s schedule, and keep a written record before approval.</p><Button href="/marketplace/candidate/invitations" variant="secondary">Review invitations</Button></Card>
            </Stack>
          </div>
        ) : (
          <Card>
            <div className="marketplace-message-layout">
              <div className="marketplace-selection-list">
                <p className="caption text-ink-muted">Job rooms</p>
                {threads.map(({ room, proposal }) => (
                  <button key={room.id} type="button" className={`marketplace-selection-item ${selected?.room.id === room.id ? "marketplace-selection-item-active" : ""}`} onClick={() => setSelectedKey(room.id)}>
                    <span className="body-strong marketplace-truncate">{room.title}</span>
                    <Badge label={proposal.status} tone={proposal.status === "Approved" ? "success" : "neutral"} />
                  </button>
                ))}
              </div>
              {selected && (
                <Stack gap={16} className="marketplace-applicant-chat">
                  <div>
                    <h2 className="h2">{selected.room.title}</h2>
                    <div className="marketplace-message-room-meta"><p className="caption text-ink-muted">Conversation with the client</p><Badge label={selected.proposal.status} tone={selected.proposal.status === "Approved" ? "success" : "neutral"} /></div>
                  </div>
                  <div className="marketplace-message-context-grid">
                    <Card title="Proposal snapshot" meta="The commercial terms stay visible while you talk.">
                      <div className="marketplace-message-facts"><span>{selected.proposal.candidateRate}</span><span>{selected.proposal.estimatedTimelineText}</span><span>{selected.proposal.availabilityText}</span></div>
                    </Card>
                    <Card title="Next step" meta="Keep the workflow moving.">
                      {selected.proposal.status === "Approved" ? <Link className="os-link" href="/marketplace/candidate/work">Open active work →</Link> : <p className="body-sm text-ink-muted">Clarify scope, milestones, and start date here before accepting an offer.</p>}
                    </Card>
                  </div>
                  <Card title="Room notifications" meta="Important events stay visible next to the chat">
                    <div className="marketplace-review-list">
                      <div><strong className="body-strong">Proposal status</strong><p className="body-sm text-ink-muted">This room is currently {selected.proposal.status.toLowerCase()}.</p></div>
                      <div><strong className="body-strong">Next client action</strong><p className="body-sm text-ink-muted">Review the latest message, then confirm scope or availability.</p></div>
                    </div>
                  </Card>
                  <Card title="Deal checklist" meta="Keep the conversation moving toward an approved room">
                    <div className="marketplace-review-list">
                      <div><strong className="body-strong">Brief understood</strong><p className="body-sm text-ink-muted">Confirm the outcome, responsibilities, and dependencies in chat.</p></div>
                      <div><strong className="body-strong">Commercial terms</strong><p className="body-sm text-ink-muted">Confirm {selected.proposal.candidateRate}, {selected.proposal.estimatedTimelineText}, and {selected.proposal.availabilityText}.</p></div>
                      <div><strong className="body-strong">Job hunter schedule</strong><p className="body-sm text-ink-muted">The job hunter owns the calendar; agreed interview or evaluation details appear in this conversation.</p></div>
                      <div><strong className="body-strong">Approval</strong><p className="body-sm text-ink-muted">After approval, this room moves to Active Work with milestones, files, payment, and delivery history.</p></div>
                    </div>
                    {selected.proposal.status === "Approved" && <Button href="/marketplace/candidate/work" variant="primary">Open Active Work</Button>}
                  </Card>
                  <Chat>
                    {selected.messages.length ? selected.messages.map((message, index) => (
                      <ChatMessage key={`${message.timestamp}-${index}`} author={message.senderRole === "Candidate" ? "You" : "Job hunter"} initials={message.senderRole === "Candidate" ? "ME" : "JH"} body={message.text} own={message.senderRole === "Candidate"} time={message.timestamp} />
                    )) : <EmptyState title="Start the conversation" description="Introduce yourself or ask a question about the brief." />}
                  </Chat>
                  <ChatComposer value={draft} onChange={setDraft} onSend={send} placeholder="Write a message to the client" />
                </Stack>
              )}
            </div>
          </Card>
        )}
      </Stack>
    </PageBody>
  );
}
