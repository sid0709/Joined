"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Card, Chat, ChatComposer, ChatMessage, EmptyState, PageBody, Stack } from "@/src/shared/marketplace-ui";
import { useMockAuth } from "@/src/shared/auth/MockAuthContext";
import { useJobRoomsContext } from "@/src/shared/job-rooms/JobRoomsContext";
import { ProposalStatus } from "@/src/shared/types/job-room";

const statusTone: Record<ProposalStatus, "neutral" | "primary" | "success"> = {
  Pending: "neutral",
  "In Discussion": "primary",
  Shortlisted: "primary",
  Invited: "primary",
  Rejected: "neutral",
  Archived: "neutral",
  Approved: "success",
} as const;

export default function CandidateBidsPage() {
  const { currentUser } = useMockAuth();
  const { allRooms, applicationsRegistry, sendChatMessage } = useJobRoomsContext();
  const candidateId = currentUser?.email ?? "logged-in-user";
  const bids = allRooms.flatMap((room) => {
    const proposal = applicationsRegistry[room.id]?.proposals.find((item) => item.id === candidateId);
    return proposal ? [{ room, proposal }] : [];
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const selected = bids.find(({ room }) => room.id === selectedId) ?? bids[0];
  const send = () => {
    if (!selected || !draft.trim()) return;
    sendChatMessage(selected.room.id, selected.proposal.id, "Candidate", draft.trim());
    setDraft("");
  };

  return (
    <PageBody>
      <Stack gap={24}>
        <div className="marketplace-page-header">
          <div>
            <span className="label text-primary">CANDIDATE WORKSPACE</span>
            <h1 className="h1">My bids</h1>
            <p className="body text-ink-muted">Track every proposal from first review through approval.</p>
          </div>
          <Button href="/marketplace/jobs" variant="primary">Find more work</Button>
        </div>
        <div className="marketplace-skeleton-grid">
          <Card title="Submitted" meta="Your complete proposals"><strong className="marketplace-dashboard-stat-value">{bids.length}</strong><p className="body-sm text-ink-muted">Job links with bids</p></Card>
          <Card title="Client review" meta="Shortlist, message, or evaluation"><strong className="marketplace-dashboard-stat-value">{bids.filter(({ proposal }) => ["Pending", "In Discussion", "Shortlisted", "Invited"].includes(proposal.status)).length}</strong><p className="body-sm text-ink-muted">Waiting for next action</p></Card>
          <Card title="Awarded" meta="Approved for delivery"><strong className="marketplace-dashboard-stat-value">{bids.filter(({ proposal }) => proposal.status === "Approved").length}</strong><p className="body-sm text-ink-muted">Ready for the workroom</p></Card>
        </div>
        <Card title="Job links in your pipeline" meta="Use these links to return to the original brief, not just the message thread.">
          {bids.length ? <div className="marketplace-skeleton-grid">{bids.map(({ room, proposal }) => <div key={room.id}><strong className="body-strong">{room.title}</strong><p className="body-sm text-ink-muted">{room.sourceCompany ?? "External company"} · {proposal.status} · {room.rateOrBudgetRangeText}</p><Link className="os-link" href={`/marketplace/jobs?room=${room.id}`}>Open job brief →</Link></div>)}</div> : <p className="body-md text-ink-muted">Your job links will appear here after you submit your first bid from the job pool.</p>}
        </Card>
        {!bids.length ? (
          <Card>
            <EmptyState title="Your bid pipeline is ready" description="Submit a bid from Find Work and it will appear here with its current status." />
          </Card>
        ) : (
          <Stack gap={16}>
            {bids.map(({ room, proposal }) => (
              <Card key={room.id} raised>
                <Stack gap={12}>
                  <div className="marketplace-page-header">
                    <div>
                      <span className="caption text-ink-muted">{room.postedTimeText}</span>
                      <h2 className="h2">{room.title}</h2>
                    </div>
                    <Badge label={proposal.status} tone={statusTone[proposal.status]} />
                  </div>
                  <p className="body-strong">Your proposal: {proposal.candidateRate} · {proposal.estimatedTimelineText}</p>
                  <p className="body-sm text-ink-muted">{proposal.availabilityText} · {proposal.milestones.length} milestones · {proposal.workExamples.length} work examples</p>
                  <p className="body text-ink-muted">{proposal.coverLetterText}</p>
                  <Card title="Job hunter judgement" meta="The review that guides the next action"><div className="marketplace-review-list"><div><strong className="body-strong">Application status</strong><p className="body-sm text-ink-muted">{proposal.status === "Pending" ? "Waiting for the job hunter to review this application." : `The job hunter marked this application ${proposal.status.toLowerCase()}.`}</p></div><div><strong className="body-strong">Private review note</strong><p className="body-sm text-ink-muted">{proposal.clientNote ?? "No private note has been added yet."}</p></div><div><strong className="body-strong">Recommended next step</strong><p className="body-sm text-ink-muted">{proposal.status === "Approved" ? "Move into Active Work and follow the company application." : "Discuss fit, company requirements, and follow-up timing with the job hunter."}</p></div></div></Card>
                  <div className="marketplace-card-footer">
                    <span className="caption text-ink-muted">{room.budgetType}: {room.rateOrBudgetRangeText}</span>
                    <div className="marketplace-inline-actions">
                      <Button type="button" size="sm" variant="secondary" onClick={() => setSelectedId(room.id)}>Discuss this application</Button>
                      <Link className="os-link" href="/marketplace/jobs">View job</Link>
                    </div>
                  </div>
                </Stack>
              </Card>
            ))}
          </Stack>
        )}
        {selected && <Card title={`Collaboration · ${selected.room.title}`} meta="Bidder and job hunter discussion stays attached to this application"><Stack gap={16}><div className="marketplace-message-context-grid"><Card title="Application context" meta="Shared before the company is contacted"><p className="body-sm">{selected.room.sourceCompany ?? "External company"} · {selected.room.title}</p><p className="body-sm text-ink-muted">{selected.room.descriptionParagraph}</p><div className="marketplace-message-facts"><span>{selected.proposal.candidateRate}</span><span>{selected.proposal.estimatedTimelineText}</span><span>{selected.proposal.availabilityText}</span></div></Card><Card title="Decision status" meta="Job hunter judgement"><Badge label={selected.proposal.status} tone={statusTone[selected.proposal.status]} /><p className="body-sm text-ink-muted">{selected.proposal.clientNote ?? "The job hunter can add guidance here after reviewing the application."}</p></Card></div><Chat>{(applicationsRegistry[selected.room.id]?.chatHistory[selected.proposal.id] ?? []).length ? (applicationsRegistry[selected.room.id]?.chatHistory[selected.proposal.id] ?? []).map((message, index) => <ChatMessage key={`${message.timestamp}-${index}`} author={message.senderRole === "Candidate" ? "You" : "Job hunter"} initials={message.senderRole === "Candidate" ? "ME" : "JH"} body={message.text} own={message.senderRole === "Candidate"} time={message.timestamp} />) : <EmptyState title="Start the application discussion" description="Ask whether the job fits, share concerns, or agree the next follow-up with the job hunter." />}</Chat><ChatComposer value={draft} onChange={setDraft} onSend={send} placeholder="Discuss this application with the job hunter" /></Stack></Card>}
      </Stack>
    </PageBody>
  );
}
