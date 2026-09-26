"use client";

import { useState } from "react";
import { Badge, Button, Card, EmptyState, Input, PageBody, Stack } from "@/src/shared/marketplace-ui";
import { JobRoomCard } from "@/src/shared/components/JobRoomCard";
import { JobDetailDrawer } from "@/src/shared/components/JobDetailDrawer";
import { useJobRoomsContext } from "@/src/shared/job-rooms/JobRoomsContext";
import { useMockAuth } from "@/src/shared/auth/MockAuthContext";
import { JobRoomRecord, ProposalDraft } from "@/src/shared/types/job-room";
import { WorkflowSteps } from "@/src/shared/components/WorkflowSteps";

export function MarketplaceJobsView() {
  const { rooms, allRooms, filters, updateFilters, applyToJob } = useJobRoomsContext();
  const { currentUser, profile } = useMockAuth();
  const [selected, setSelected] = useState<JobRoomRecord | null>(null);
  const [notice, setNotice] = useState("");

  const apply = (id: string, proposal: ProposalDraft) => {
    applyToJob(id, { ...profile, fullName: currentUser?.fullName, email: currentUser?.email }, proposal);
    setNotice("Your complete proposal was submitted. Open Messages when the client responds.");
  };

  const candidateId = currentUser?.email ?? "logged-in-user";
  const approvedBidder = allRooms.some((room) => room.workflow?.proposals.some((proposal) => proposal.id === candidateId && proposal.status === "Approved"));

  if (!approvedBidder) {
    return (
      <PageBody>
        <Stack gap={24}>
          <div className="marketplace-page-header marketplace-page-intro">
            <div><span className="label text-primary">CANDIDATE ACCESS</span><h1 className="display">Job pool access is earned</h1><p className="body text-ink-muted">Bidders do not browse job hunters or a public client list. Keep your profile visible, then wait for a job hunter to approve you and assign a job link.</p></div>
            <Badge label="Awaiting client approval" tone="neutral" />
          </div>
          <div className="marketplace-dashboard-grid">
            <Card title="Your bidder profile" meta="This is what job hunters evaluate before approval"><p className="body-strong">{profile.title}</p><p className="body-sm text-ink-muted">{profile.hourlyRate}/hr · {profile.skills.join(" · ")}</p><Button href="/marketplace/candidate/profile" variant="primary">Expose profile</Button></Card>
            <Card title="What happens next" meta="The job hunter controls the first connection"><p className="body-sm">1. A job hunter finds your profile.</p><p className="body-sm">2. They approve you or invite you to an evaluation.</p><p className="body-sm">3. They assign a job link to your account.</p><p className="body-sm">4. The approved job appears here so you can bid.</p></Card>
          </div>
          <Card title="Assigned job links" meta="Nothing is available until a client assigns work"><EmptyState title="No assigned job links yet" description="Your bids, messages, and notifications will appear after a job hunter starts a relationship with you." /></Card>
        </Stack>
      </PageBody>
    );
  }

  const visibleRooms = rooms;

  return (
    <PageBody>
      <Stack gap={24}>
        <div className="marketplace-page-header">
          <div>
            <span className="label text-primary">MARKETPLACE</span>
            <h1 className="display">Job pool</h1>
            <p className="body text-ink-muted">Bidders do not search for job hunters here. Review the open job pool, submit a complete bid, and keep your profile visible to clients who are looking for your skills.</p>
          </div>
            <Badge label={`${visibleRooms.length} assigned jobs`} tone="neutral" />
        </div>

        <div className="marketplace-filter-row">
          <Input
            label="Search"
            placeholder="Search jobs, skills, or outcomes"
            value={filters.searchQuery}
            onChange={(event) => updateFilters({ searchQuery: event.target.value })}
          />
          <Button variant="secondary" onClick={() => updateFilters({ searchQuery: "" })}>Clear filters</Button>
        </div>

        {notice && <p className="body-sm text-success">{notice}</p>}

        <WorkflowSteps title="How a bidder gets work" meta="Your public profile is discovered by clients; the job pool is where you respond to their briefs." steps={[
          { label: "Expose your profile", description: "Keep skills, performance, availability, and work examples current.", state: "complete" },
          { label: "Review the job pool", description: "Choose briefs that match your expertise and rate.", state: "current" },
          { label: "Submit a complete bid", description: "Include price, timeline, availability, cover letter, milestones, and examples.", state: "upcoming" },
          { label: "Discuss and schedule", description: "The client may message you or invite you to an evaluation.", state: "upcoming" },
          { label: "Contract and deliver", description: "Approved work moves into a shared room with funded milestones.", state: "locked" },
        ]} />

        <div className="marketplace-jobs-grid">
          <Stack gap={16}>
            {visibleRooms.map((room) => (
              <JobRoomCard
                key={room.id}
                room={room}
                onSelect={() => setSelected(room)}
                onBidAction={() => setSelected(room)}
              />
            ))}
            {!visibleRooms.length && <EmptyState title="No assigned jobs match your search" description="Try clearing a filter or return to your bidder profile." />}
          </Stack>
          <Card title="Assigned job pool" meta="These links were provided by job hunters who approved your profile">
            <ol className="body text-ink-muted marketplace-step-list">
              <li>Open the assigned brief</li>
              <li>Submit a bid against the brief</li>
              <li>Discuss milestones in the room</li>
              <li>Start only after approval and funding</li>
            </ol>
          </Card>
        </div>
      </Stack>
      <JobDetailDrawer room={selected} profile={profile} onClose={() => setSelected(null)} onApply={(id, proposal) => { apply(id, proposal); setSelected(null); }} />
    </PageBody>
  );
}
