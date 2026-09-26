"use client";

import { EmptyState, PageBody, Stack } from "@/src/shared/marketplace-ui";
import { ClientWorkspace } from "@/src/client/components/ClientWorkspace";
import { ClientApplicationsManager } from "@/src/client/components/ClientApplicationsManager";
import { JobRoomCard } from "@/src/shared/components/JobRoomCard";
import { useClientDashboard } from "@/src/client/hooks/useClientDashboard";
import { useIsMounted } from "@/src/shared/hooks/useIsMounted";
import { WorkflowSteps } from "@/src/shared/components/WorkflowSteps";

export function ClientDashboardView() {
  const {
    clientRooms,
    postedRooms,
    applicationsRegistry,
    handlePostJob,
    handleSendChatMessage,
    handleApproveProposal,
    handleReviewProposal,
    handleUpdateProposalNote,
    currentUser,
  } = useClientDashboard();
  const isMounted = useIsMounted();
  const greetingText = isMounted && currentUser?.fullName ? `Welcome back, ${currentUser.fullName}` : "Welcome back";

  return (
    <PageBody>
      <Stack gap={24}>
        <div className="marketplace-page-toolbar">
          <div>
            <span className="body-strong">{greetingText}</span>
            <span className="label text-ink-muted marketplace-toolbar-note">Client workspace</span>
          </div>
        </div>
        <WorkflowSteps title="Your hiring journey" meta="The job room keeps the brief, bidders, evaluation, contract, and delivery together." steps={[
          { label: "Create job room", description: "Define the brief, rate range, timeline, and milestones.", state: "current" },
          { label: "Receive proposals", description: "Review complete bids and keep every response attached to the room.", state: "upcoming" },
          { label: "Compare bidders", description: "Shortlist, note, invite, and compare price, timeline, and performance.", state: "upcoming" },
          { label: "Schedule evaluation", description: "Use a test or interview to verify the best-fit candidate.", state: "upcoming" },
          { label: "Contract and pay", description: "Fund milestones, review delivery, resolve issues, and leave a review.", state: "locked" },
        ]} />
        <ClientWorkspace onPostJob={handlePostJob} />
        <ClientApplicationsManager
          rooms={clientRooms}
          registry={applicationsRegistry}
          onSendMessage={handleSendChatMessage}
          onApprove={handleApproveProposal}
          onReviewProposal={handleReviewProposal}
          onUpdateProposalNote={handleUpdateProposalNote}
        />
        <section>
          <h2 className="h2">Your active room postings</h2>
          <Stack gap={16}>
            {postedRooms.map((room) => <JobRoomCard key={room.id} room={room} showBidButton={false} />)}
            {postedRooms.length === 0 && <EmptyState title="No job rooms posted yet" description="Create a room above to start receiving applications." />}
          </Stack>
        </section>
      </Stack>
    </PageBody>
  );
}
