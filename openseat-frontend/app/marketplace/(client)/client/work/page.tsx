"use client";

import Link from "next/link";
import { Badge, Button, Card, EmptyState, PageBody, Stack } from "@/src/shared/marketplace-ui";
import { JobRoomWorkPanel } from "@/src/shared/components/JobRoomWorkPanel";
import { useClientDashboard } from "@/src/client/hooks/useClientDashboard";

export default function ClientWorkPage() {
  const { clientRooms, applicationsRegistry } = useClientDashboard();
  const activeWork = clientRooms.flatMap((room) => {
    const workflow = applicationsRegistry[room.id];
    const selectedCandidateId = workflow?.selectedCandidateId;
    const proposal = workflow?.proposals.find((item) => item.id === selectedCandidateId && item.status === "Approved");
    return proposal && workflow ? [{ room, proposal, workflow }] : [];
  });
  const roomsWithApplicants = clientRooms.filter((room) => (applicationsRegistry[room.id]?.proposals.length ?? 0) > 0);
  const proposalCount = clientRooms.reduce((sum, room) => sum + (applicationsRegistry[room.id]?.proposals.length ?? 0), 0);
  const reviewCount = clientRooms.reduce((sum, room) => sum + (applicationsRegistry[room.id]?.proposals.filter((proposal) => ["Pending", "In Discussion", "Shortlisted", "Invited"].includes(proposal.status)).length ?? 0), 0);
  const fundedCount = activeWork.reduce((sum, item) => sum + item.workflow.milestones.filter((milestone) => ["Funded", "In Progress", "In Review"].includes(milestone.status)).length, 0);

  return <PageBody><Stack gap={24}>
    <div className="marketplace-page-header marketplace-page-intro"><div><span className="label text-primary">CLIENT WORKSPACE</span><h1 className="h1">Managed Work</h1><p className="body text-ink-muted">Control approved contracts from one room: fund milestones, review delivery, message bidders, manage files, resolve issues, and release fair payment.</p></div><div className="marketplace-inline-actions"><Button href="/marketplace/client/applications" variant="secondary">Review applications</Button><Button href="/marketplace/client/payments" variant="primary">Open payments</Button></div></div>
    <div className="marketplace-dashboard-stats"><Card><strong className="marketplace-dashboard-stat-value">{activeWork.length}</strong><span className="caption">Active contracts</span></Card><Card><strong className="marketplace-dashboard-stat-value">{fundedCount}</strong><span className="caption">Funded milestones</span></Card><Card><strong className="marketplace-dashboard-stat-value">{reviewCount}</strong><span className="caption">Applicants in review</span></Card><Card><strong className="marketplace-dashboard-stat-value">{proposalCount}</strong><span className="caption">Total proposals</span></Card></div>
    {activeWork.length ? activeWork.map(({ room, proposal }) => <JobRoomWorkPanel key={`${room.id}-${proposal.id}`} room={room} proposal={proposal} role="Client" />) : <>
      <div className="marketplace-dashboard-grid"><Card title="No approved contract yet" meta="Approve a bidder from Applications to open the full workroom"><EmptyState title="Managed Work is ready for your first hire" description="Once you approve a proposal, the contract, milestones, payments, files, delivery history, messages, disputes, and reviews will appear here." /><div className="marketplace-inline-actions"><Button href="/marketplace/client/applications" variant="primary">Open Applications</Button><Button href="/marketplace/client/jobs" variant="secondary">Review Job Rooms</Button></div></Card><Card title="Post-hire control center" meta="What you will manage after approval"><div className="marketplace-review-list"><div><strong className="body-strong">Contract and funding</strong><p className="body-sm text-ink-muted">Confirm terms and fund each milestone before work begins.</p></div><div><strong className="body-strong">Delivery review</strong><p className="body-sm text-ink-muted">Review submissions, request changes, and release payment.</p></div><div><strong className="body-strong">Collaboration record</strong><p className="body-sm text-ink-muted">Keep messages, files, disputes, and reviews attached to the room.</p></div></div></Card></div>
      <Card title="Rooms approaching managed work" meta="These rooms have bidder activity but do not have an approved contract"><div className="marketplace-review-list">{roomsWithApplicants.length ? roomsWithApplicants.map((room) => <div key={room.id}><div className="marketplace-card-footer"><div><strong className="body-strong">{room.title}</strong><p className="body-sm text-ink-muted">{applicationsRegistry[room.id].proposals.length} proposal(s) · {room.rateOrBudgetRangeText}</p></div><Badge label={room.proposalsCountText} tone="neutral" /></div><Link className="os-link" href="/marketplace/client/applications">Review bidders →</Link></div>) : <p className="body-md text-ink-muted">No rooms have received proposals yet.</p>}</div></Card>
    </>}
  </Stack></PageBody>;
}
