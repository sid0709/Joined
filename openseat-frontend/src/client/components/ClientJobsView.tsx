"use client";

import { EmptyState, PageBody, Stack } from "@openseat/design-system";
import { JobRoomCard } from "@/src/shared/components/JobRoomCard";
import { useClientDashboard } from "@/src/client/hooks/useClientDashboard";

export function ClientJobsView() {
  const { postedRooms } = useClientDashboard();
  return (
    <PageBody>
      <Stack gap={16}>
        <div>
          <h1 className="h1">Your job rooms</h1>
          <p className="body text-ink-muted">Review the briefs you have published to the marketplace.</p>
        </div>
        {postedRooms.map((room) => <JobRoomCard key={room.id} room={room} showBidButton={false} />)}
        {postedRooms.length === 0 && <EmptyState title="No job rooms posted yet" description="Use Post Job to create your first room." />}
      </Stack>
    </PageBody>
  );
}
