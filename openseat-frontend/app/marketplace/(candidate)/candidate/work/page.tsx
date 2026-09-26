"use client";

import Link from "next/link";
import { Badge, Button, Card, EmptyState, PageBody, Stack } from "@/src/shared/marketplace-ui";
import { JobRoomWorkPanel } from "@/src/shared/components/JobRoomWorkPanel";
import { useMockAuth } from "@/src/shared/auth/MockAuthContext";
import { useJobRoomsContext } from "@/src/shared/job-rooms/JobRoomsContext";

export default function CandidateWorkPage() {
  const { currentUser } = useMockAuth();
  const { allRooms, applicationsRegistry } = useJobRoomsContext();
  const candidateId = currentUser?.email ?? "logged-in-user";
  const activeWork = allRooms.flatMap((room) => {
    const proposal = applicationsRegistry[room.id]?.proposals.find((item) => item.id === candidateId && item.status === "Approved");
    return proposal ? [{ room, proposal, workflow: applicationsRegistry[room.id] }] : [];
  });
  const pipeline = allRooms.flatMap((room) => {
    const proposal = applicationsRegistry[room.id]?.proposals.find((item) => item.id === candidateId && item.status !== "Rejected" && item.status !== "Archived");
    return proposal ? [{ room, proposal }] : [];
  });
  const milestoneCount = activeWork.reduce((total, item) => total + item.workflow.milestones.length, 0);

  return <PageBody><Stack gap={24}>
    <div className="marketplace-page-header marketplace-page-intro"><div><span className="label text-primary">BIDDER WORKSPACE</span><h1 className="h1">Active Work</h1><p className="body text-ink-muted">Your approved job rooms for delivery, milestones, files, messages, payment, disputes, and reviews.</p></div><Button href="/marketplace/messages" variant="secondary">Open Messages</Button></div>
    <div className="marketplace-dashboard-stats"><Card><strong className="marketplace-dashboard-stat-value">{activeWork.length}</strong><span className="caption">Active job rooms</span></Card><Card><strong className="marketplace-dashboard-stat-value">{milestoneCount}</strong><span className="caption">Tracked milestones</span></Card><Card><strong className="marketplace-dashboard-stat-value">{activeWork.length ? "Room" : "Waiting"}</strong><span className="caption">Payment workflow</span></Card></div>
    {activeWork.length ? activeWork.map(({ room, proposal }) => <JobRoomWorkPanel key={room.id} room={room} proposal={proposal} role="Candidate" />) : <>
      <div className="marketplace-dashboard-grid"><Card title="Waiting for an approved contract" meta="Active Work opens when a job hunter approves your proposal"><EmptyState title="No active work yet" description="Keep your bidder profile visible, respond to assigned job links, and continue conversations until a job hunter approves a contract." /><div className="marketplace-inline-actions"><Button href="/marketplace/candidate/bids" variant="primary">Review My Bids</Button><Button href="/marketplace/messages" variant="secondary">Check Messages</Button></div></Card><Card title="What this page manages" meta="Everything after approval stays in the job room"><div className="marketplace-review-list"><div><strong className="body-strong">Contract terms</strong><p className="body-sm text-ink-muted">Approved rate, timeline, and availability.</p></div><div><strong className="body-strong">Milestone delivery</strong><p className="body-sm text-ink-muted">Funded work, submissions, feedback, and releases.</p></div><div><strong className="body-strong">Collaboration</strong><p className="body-sm text-ink-muted">Room chat, files, delivery history, disputes, and reviews.</p></div></div></Card></div>
      <Card title="Your work pipeline" meta="Move from conversation to approved delivery"><div className="marketplace-skeleton-grid">{pipeline.length ? pipeline.map(({ room, proposal }) => <div key={room.id}><div className="marketplace-card-footer"><strong className="body-strong">{room.title}</strong><Badge label={proposal.status} tone={proposal.status === "Approved" ? "success" : "neutral"} /></div><p className="body-sm text-ink-muted">{proposal.candidateRate} · {proposal.estimatedTimelineText}</p><div className="marketplace-inline-actions"><Link className="os-link" href="/marketplace/messages">Open conversation →</Link><Link className="os-link" href="/marketplace/candidate/bids">View bid →</Link></div></div>) : <p className="body-md text-ink-muted">No active proposal has been connected to your account yet.</p>}</div></Card>
    </>}
  </Stack></PageBody>;
}
