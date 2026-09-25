"use client";

import { Button, EmptyState, Input, PageBody, Stack } from "@openseat/design-system";
import { FilterSidebar } from "@/src/candidate/components/FilterSidebar";
import { JobRoomCard } from "@/src/shared/components/JobRoomCard";
import { useCandidateDashboard } from "@/src/candidate/hooks/useCandidateDashboard";
import { useIsMounted } from "@/src/shared/hooks/useIsMounted";

export function CandidateDashboardView() {
  const { rooms, filters, updateFilters, handleApplyToJob, currentUser, profile, logoutUser } = useCandidateDashboard();
  const isMounted = useIsMounted();
  const greetingText = isMounted && currentUser?.fullName ? `Welcome back, ${currentUser.fullName}` : "Welcome back";
  const profileSubtext = isMounted ? `${profile.title} · ${profile.hourlyRate}/hr` : "";

  return (
    <PageBody>
      <Stack gap={24}>
        <div className="marketplace-page-toolbar">
          <div>
            <span className="body-strong">{greetingText}</span>
            {profileSubtext && <span className="label text-ink-muted marketplace-toolbar-note">{profileSubtext}</span>}
          </div>
          <Button variant="secondary" size="sm" onClick={logoutUser}>Log out</Button>
        </div>

        <Input
          label="Search project rooms"
          placeholder="Search by project, skill, or outcome"
          value={filters.searchQuery}
          onChange={(event) => updateFilters({ searchQuery: event.target.value })}
        />

        <div className="marketplace-filter-layout">
          <FilterSidebar filters={filters} onFilterChange={updateFilters} />
          <main>
            <p className="label text-ink-muted marketplace-results-label">
              Showing {rooms.length} available project rooms
            </p>
            <Stack gap={16}>
              {rooms.map((room) => <JobRoomCard key={room.id} room={room} onBidAction={handleApplyToJob} />)}
              {!rooms.length && <EmptyState title="No job rooms match those filters" description="Try clearing a filter or searching for another skill." />}
            </Stack>
          </main>
        </div>
      </Stack>
    </PageBody>
  );
}
