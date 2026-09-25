"use client";

import { Button, EmptyState, PageBody, Stack } from "@openseat/design-system";
import { ClientWorkspace } from "@/src/client/components/ClientWorkspace";
import { ClientApplicationsManager } from "@/src/client/components/ClientApplicationsManager";
import { JobRoomCard } from "@/src/shared/components/JobRoomCard";
import { useClientDashboard } from "@/src/client/hooks/useClientDashboard";
import { useIsMounted } from "@/src/shared/hooks/useIsMounted";

export function ClientDashboardView() {
  const {
    clientRooms,
    postedRooms,
    applicationsRegistry,
    handlePostJob,
    handleSendChatMessage,
    handleApproveProposal,
    currentUser,
    logoutUser,
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
          <Button variant="secondary" size="sm" onClick={logoutUser}>Log out</Button>
        </div>
        <ClientWorkspace onPostJob={handlePostJob} />
        <ClientApplicationsManager
          rooms={clientRooms}
          registry={applicationsRegistry}
          onSendMessage={handleSendChatMessage}
          onApprove={handleApproveProposal}
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
