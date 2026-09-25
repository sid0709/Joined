"use client";

import { useState } from "react";
import { Badge, Button, Card, EmptyState, Input, PageBody, Stack } from "@openseat/design-system";
import { JobRoomCard } from "@/src/shared/components/JobRoomCard";
import { JobDetailDrawer } from "@/src/shared/components/JobDetailDrawer";
import { useJobRoomsContext } from "@/src/shared/job-rooms/JobRoomsContext";
import { useMockAuth } from "@/src/shared/auth/MockAuthContext";
import { JobRoomRecord } from "@/src/shared/types/job-room";

export function MarketplaceJobsView() {
  const { rooms, filters, updateFilters, applyToJob } = useJobRoomsContext();
  const { currentUser, profile } = useMockAuth();
  const [selected, setSelected] = useState<JobRoomRecord | null>(null);
  const [notice, setNotice] = useState("");

  const apply = (id: string) => {
    applyToJob(id, { ...profile, fullName: currentUser?.fullName });
    setNotice("Your bid was submitted. Open Messages when the client responds.");
  };

  return (
    <PageBody>
      <Stack gap={24}>
        <div className="marketplace-page-header">
          <div>
            <span className="label text-primary">MARKETPLACE</span>
            <h1 className="display">Find your next contract</h1>
            <p className="body text-ink-muted">Browse jobs, inspect the brief, and submit a focused bid.</p>
          </div>
          <Badge label={`${rooms.length} open jobs`} tone="neutral" />
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

        <div className="marketplace-jobs-grid">
          <Stack gap={16}>
            {rooms.map((room) => (
              <JobRoomCard
                key={room.id}
                room={room}
                onSelect={() => setSelected(room)}
                onBidAction={apply}
              />
            ))}
            {!rooms.length && <EmptyState title="No jobs match your search" description="Try clearing a filter or searching for another skill." />}
          </Stack>
          <Card title="How bidding works" meta="A clear path from brief to delivery">
            <ol className="body text-ink-muted marketplace-step-list">
              <li>Review the brief</li>
              <li>Submit your bid</li>
              <li>Discuss milestones</li>
              <li>Start work after approval</li>
            </ol>
          </Card>
        </div>
      </Stack>
      <JobDetailDrawer room={selected} onClose={() => setSelected(null)} onApply={(id) => { apply(id); setSelected(null); }} />
    </PageBody>
  );
}
