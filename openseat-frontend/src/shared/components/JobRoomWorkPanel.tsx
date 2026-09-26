"use client";

import { useState } from "react";
import { Badge, Button, Card, Chat, ChatComposer, ChatMessage, EmptyState, Input, Select, Stack, TextArea } from "@/src/shared/marketplace-ui";
import { useJobRoomsContext } from "@/src/shared/job-rooms/JobRoomsContext";
import { JobRoomRecord, ProposalRecord } from "@/src/shared/types/job-room";

interface JobRoomWorkPanelProps {
  room: JobRoomRecord;
  proposal: ProposalRecord;
  role: "Client" | "Candidate";
}

function trustTone(verified: boolean) {
  return verified ? "success" : "neutral";
}

export function JobRoomWorkPanel({ room, proposal, role }: JobRoomWorkPanelProps) {
  const {
    applicationsRegistry,
    sendChatMessage,
    fundMilestone,
    submitMilestoneWork,
    reviewMilestone,
    addRoomFile,
    openDispute,
    resolveDispute,
    addReview,
  } = useJobRoomsContext();
  const workflow = room.workflow ?? applicationsRegistry[room.id];
  const [activeMilestoneId, setActiveMilestoneId] = useState(workflow.milestones[0]?.id ?? null);
  const [deliverySummary, setDeliverySummary] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [draft, setDraft] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [reviewRating, setReviewRating] = useState("5");
  const [reviewText, setReviewText] = useState("");

  const messages = workflow.chatHistory[proposal.id] ?? [];
  const activeMilestone = workflow.milestones.find((milestone) => milestone.id === activeMilestoneId) ?? workflow.milestones[0];
  const submitMessage = () => {
    if (!draft.trim()) return;
    sendChatMessage(room.id, proposal.id, role, draft);
    setDraft("");
  };
  const submitDelivery = () => {
    if (!activeMilestone) return;
    submitMilestoneWork(room.id, activeMilestone.id, deliverySummary);
    setDeliverySummary("");
  };
  const submitDispute = () => {
    openDispute(room.id, role, disputeReason);
    setDisputeReason("");
    setShowDisputeForm(false);
  };

  return (
    <Stack gap={24} className="marketplace-workroom">
      <div className="marketplace-workroom-header">
        <div>
          <span className="label text-primary">{role === "Client" ? "MANAGED WORK" : "ACTIVE WORK"}</span>
          <h2 className="h1">{room.title}</h2>
          <p className="body text-ink-muted">{role === "Client" ? `Working with ${proposal.candidateName}` : "Your proposal, contract, delivery history, and messages in one room."}</p>
        </div>
        <Badge label={workflow.workStatus} tone={workflow.workStatus === "Completed" ? "success" : workflow.workStatus === "Disputed" ? "danger" : "neutral"} />
      </div>

      <div className="marketplace-trust-grid">
        <Card title="Trust & payment" meta="Release work only through the room workflow.">
          <div className="marketplace-trust-list">
            <div><span>Client payment</span><Badge label={workflow.trust.paymentVerified ? "Verified" : "Not verified"} tone={trustTone(workflow.trust.paymentVerified)} /></div>
            <div><span>Client identity</span><Badge label={workflow.trust.clientIdentityVerified ? "Verified" : "Pending"} tone={trustTone(workflow.trust.clientIdentityVerified)} /></div>
            <div><span>Candidate identity</span><Badge label={workflow.trust.candidateIdentityVerified ? "Verified" : "Pending"} tone={trustTone(workflow.trust.candidateIdentityVerified)} /></div>
            <div><span>Escrow</span><Badge label={workflow.trust.escrowStatus} tone={workflow.trust.escrowStatus === "On hold" ? "danger" : workflow.trust.escrowStatus === "Not funded" ? "neutral" : "primary"} /></div>
          </div>
        </Card>
        <Card title="Contract terms" meta="Agreed from the selected proposal.">
          <div className="marketplace-workroom-terms">
            <div><span>Price</span><strong>{proposal.candidateRate}</strong></div>
            <div><span>Timeline</span><strong>{proposal.estimatedTimelineText}</strong></div>
            <div><span>Availability</span><strong>{proposal.availabilityText}</strong></div>
          </div>
        </Card>
      </div>

      <Card title="Milestones" meta="Each milestone has a fund, submit, review, and release state.">
        <Stack gap={12}>
          {workflow.milestones.length ? workflow.milestones.map((milestone) => (
            <div key={milestone.id} className={`marketplace-work-milestone ${activeMilestone?.id === milestone.id ? "marketplace-work-milestone-active" : ""}`}>
              <button type="button" className="marketplace-work-milestone-select" onClick={() => setActiveMilestoneId(milestone.id)}>
                <span><strong className="body-strong">{milestone.title}</strong><span className="caption text-ink-muted">{milestone.deliverable}</span></span>
                <span className="marketplace-work-milestone-meta"><span className="caption text-ink-muted">{milestone.amountText} · {milestone.dueDate}</span><Badge label={milestone.status} tone={milestone.status === "Paid" ? "success" : milestone.status === "Changes Requested" ? "danger" : "neutral"} /></span>
              </button>
              {role === "Client" && milestone.status === "Proposed" && <Button type="button" variant="secondary" size="sm" onClick={() => fundMilestone(room.id, milestone.id)}>Fund milestone</Button>}
              {role === "Client" && milestone.status === "In Review" && <div className="marketplace-inline-actions"><Button type="button" variant="primary" size="sm" onClick={() => reviewMilestone(room.id, milestone.id, "approve")}>Approve & release</Button><Button type="button" variant="secondary" size="sm" onClick={() => reviewMilestone(room.id, milestone.id, "changes", feedbackText)}>Request changes</Button></div>}
            </div>
          )) : <EmptyState title="No milestones yet" description="Approve a proposal to turn its delivery plan into funded milestones." />}
          {role === "Candidate" && activeMilestone && ["Funded", "In Progress", "Changes Requested"].includes(activeMilestone.status) && (
            <div className="marketplace-workroom-action-form">
              <TextArea label={`Submit progress for ${activeMilestone.title}`} value={deliverySummary} onChange={(event) => setDeliverySummary(event.target.value)} placeholder="Describe what is ready for review and link any files in the room." />
              <Button type="button" variant="primary" onClick={submitDelivery}>Submit milestone for review</Button>
            </div>
          )}
          {role === "Client" && activeMilestone?.status === "In Review" && <TextArea label="Feedback for this review" value={feedbackText} onChange={(event) => setFeedbackText(event.target.value)} placeholder="Explain what is approved or what needs to change." />}
        </Stack>
      </Card>

      <div className="marketplace-workroom-grid">
        <Card title="Files" meta="Briefs, references, and delivery artifacts stay attached to the room.">
          <Stack gap={12}>
            {workflow.files.length ? workflow.files.map((file) => <div key={file.id} className="marketplace-file-row"><div><strong className="body-strong">{file.name}</strong><span className="caption text-ink-muted">{file.description || "Room attachment"}</span></div><span className="caption text-ink-muted">{file.sizeText} · {file.uploadedAt}</span></div>) : <p className="body-sm text-ink-muted">No files uploaded yet.</p>}
            <label className="marketplace-file-input"><span className="button">Add room file</span><input type="file" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; addRoomFile(room.id, { name: file.name, description: "Uploaded to the job room", uploadedByRole: role, sizeText: `${Math.max(1, Math.round(file.size / 1024))} KB` }); event.currentTarget.value = ""; }} /></label>
          </Stack>
        </Card>
        <Card title="Delivery history" meta="A durable audit trail for every submission and review.">
          {workflow.deliveryHistory.length ? <div className="marketplace-delivery-history">{workflow.deliveryHistory.map((delivery) => <div key={delivery.id}><div className="marketplace-card-footer"><strong className="body-strong">{delivery.milestoneTitle}</strong><Badge label={delivery.status} tone={delivery.status === "Approved" ? "success" : delivery.status === "Changes Requested" ? "danger" : "neutral"} /></div><p className="body-sm text-ink-muted">{delivery.summary}</p><span className="caption text-ink-muted">Submitted {delivery.submittedAt}</span></div>)}</div> : <p className="body-sm text-ink-muted">No deliveries have been submitted yet.</p>}
        </Card>
      </div>

      <Card title="Room messages" meta="Conversation stays beside the contract and delivery record.">
        <div className="marketplace-workroom-chat">
          <Chat>{messages.length ? messages.map((message, index) => <ChatMessage key={`${message.timestamp}-${index}`} author={message.senderRole === role ? "You" : role === "Client" ? proposal.candidateName : "Client"} initials={message.senderRole === role ? "ME" : role === "Client" ? proposal.candidateName.slice(0, 2).toUpperCase() : "CL"} body={message.text} own={message.senderRole === role} time={message.timestamp} />) : <EmptyState title="Start the room conversation" description="Align on the first milestone, dependencies, and expected review cadence." />}</Chat>
          <ChatComposer value={draft} onChange={setDraft} onSend={submitMessage} placeholder="Write a room message" />
        </div>
      </Card>

      {workflow.dispute && <Card title="Dispute status" meta="This room is paused while the issue is resolved."><div className="marketplace-dispute-row"><div><Badge label={workflow.dispute.status} tone={workflow.dispute.status === "Resolved" ? "success" : "danger"} /><p className="body-sm text-ink-muted">{workflow.dispute.reason}</p></div>{workflow.dispute.status !== "Resolved" && <Button type="button" variant="secondary" onClick={() => resolveDispute(room.id, "release")}>Mark resolved</Button>}</div></Card>}
      {!workflow.dispute && (
        <div className="marketplace-dispute-actions">
          {!showDisputeForm ? <Button type="button" variant="ghost" onClick={() => setShowDisputeForm(true)}>Report an issue</Button> : <div className="marketplace-dispute-form"><TextArea label="What needs attention?" value={disputeReason} onChange={(event) => setDisputeReason(event.target.value)} placeholder="Describe the delivery, payment, or communication issue." /><div className="marketplace-inline-actions"><Button type="button" variant="secondary" onClick={submitDispute}>Open dispute</Button><Button type="button" variant="secondary" onClick={() => setShowDisputeForm(false)}>Cancel</Button></div></div>}
        </div>
      )}
      <Card title="Reviews" meta="Reviews unlock after the room is completed and help the marketplace build trust.">
        {workflow.reviews.length ? <div className="marketplace-review-list">{workflow.reviews.map((review) => <div key={review.id}><div className="marketplace-card-footer"><strong className="body-strong">{review.authorRole} review</strong><Badge label={`${review.rating}/5`} tone="success" /></div><p className="body-sm text-ink-muted">{review.text}</p><span className="caption text-ink-muted">{review.createdAt}</span></div>)}</div> : <p className="body-sm text-ink-muted">No reviews yet.</p>}
        {workflow.workStatus === "Completed" && !workflow.reviews.some((review) => review.authorRole === role) && <div className="marketplace-review-form"><div className="marketplace-form-grid"><Select label="Rating" value={reviewRating} onChange={(event) => setReviewRating(event.target.value)}><option value="5">5 — Excellent</option><option value="4">4 — Strong</option><option value="3">3 — Good</option><option value="2">2 — Needs work</option><option value="1">1 — Poor</option></Select><Input label="Review" value={reviewText} onChange={(event) => setReviewText(event.target.value)} placeholder="What should the next collaborator know?" /></div><Button type="button" variant="primary" onClick={() => { addReview(room.id, role, Number(reviewRating), reviewText); setReviewText(""); }}>Publish review</Button></div>}
      </Card>
    </Stack>
  );
}
