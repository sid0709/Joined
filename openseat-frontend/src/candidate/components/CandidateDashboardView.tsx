"use client";

import Link from "next/link";

import { useCandidateDashboard } from "@/src/candidate/hooks/useCandidateDashboard";
import { WorkflowSteps } from "@/src/shared/components/WorkflowSteps";
import { useIsMounted } from "@/src/shared/hooks/useIsMounted";
import { Badge, Button, Card, EmptyState, PageBody, Stack } from "@/src/shared/marketplace-ui";

export function CandidateDashboardView() {
  const { rooms, allRooms, applicationsRegistry, currentUser, profile } = useCandidateDashboard();
  const isMounted = useIsMounted();
  const greetingText =
    isMounted && currentUser?.fullName ? `Welcome back, ${currentUser.fullName}` : "Welcome back";
  const candidateId = currentUser?.email ?? "logged-in-user";
  const bids = allRooms.flatMap((room) => {
    const proposal = applicationsRegistry[room.id]?.proposals.find(
      (item) => item.id === candidateId,
    );
    return proposal ? [{ room, proposal }] : [];
  });
  const activeWork = bids.filter(({ proposal }) => proposal.status === "Approved");
  const conversations = bids.filter(({ proposal }) =>
    ["In Discussion", "Invited"].includes(proposal.status),
  );

  return (
    <PageBody>
      <Stack gap={24}>
        <div className="marketplace-page-toolbar">
          <div>
            <span className="label text-primary">CANDIDATE HOME</span>
            <h1 className="display">{greetingText}</h1>
            <p className="body text-ink-muted">
              Your home for proposal momentum, active delivery, and the next opportunity.
            </p>
          </div>
          <Button href="/marketplace/jobs" variant="primary">
            Find work
          </Button>
        </div>

        <div className="marketplace-dashboard-stats">
          <Card>
            <strong className="marketplace-dashboard-stat-value">{bids.length}</strong>
            <span className="caption">Submitted proposals</span>
          </Card>
          <Card>
            <strong className="marketplace-dashboard-stat-value">{conversations.length}</strong>
            <span className="caption">Active conversations</span>
          </Card>
          <Card>
            <strong className="marketplace-dashboard-stat-value">{activeWork.length}</strong>
            <span className="caption">Projects in delivery</span>
          </Card>
        </div>

        <WorkflowSteps
          title="Your marketplace journey"
          meta="Each room moves from discovery to verified delivery and fair payment."
          steps={[
            {
              label: "Complete profile",
              description: "Expose your skills, work examples, availability, and rate.",
              state: "complete",
            },
            {
              label: "Find a job room",
              description: "Browse briefs where your experience is a strong match.",
              state: "current",
            },
            {
              label: "Submit a proposal",
              description: "Send price, timeline, cover letter, milestones, and examples.",
              state: "upcoming",
            },
            {
              label: "Schedule evaluation",
              description: "Use the calendar to build a verified performance record.",
              state: "upcoming",
            },
            {
              label: "Deliver and get paid",
              description: "Work through funded milestones in the shared room.",
              state: "locked",
            },
          ]}
        />

        <div className="marketplace-dashboard-grid">
          <Card
            title="Your pipeline"
            meta="Every room stays attached to its proposal and next action."
          >
            {bids.length ? (
              <Stack gap={12}>
                {bids.slice(0, 4).map(({ room, proposal }) => (
                  <div key={room.id} className="marketplace-dashboard-list-row">
                    <div>
                      <strong className="body-strong">{room.title}</strong>
                      <span className="caption text-ink-muted">
                        {proposal.candidateRate} · {proposal.estimatedTimelineText}
                      </span>
                    </div>
                    <Badge
                      label={proposal.status}
                      tone={proposal.status === "Approved" ? "success" : "neutral"}
                    />
                  </div>
                ))}
                <Link className="os-link" href="/marketplace/candidate/bids">
                  Open all bids →
                </Link>
              </Stack>
            ) : (
              <EmptyState
                title="Your pipeline is empty"
                description="Open the discovery marketplace to find a room that fits your expertise."
              />
            )}
          </Card>
          <Card title="Profile readiness" meta="Trust signals help clients decide faster.">
            <Stack gap={12}>
              <div className="marketplace-readiness-meter">
                <span style={{ width: `${profile.skills.length ? 80 : 45}%` }} />
              </div>
              <strong className="body-strong">{profile.title || "Add a professional title"}</strong>
              <p className="body-sm text-ink-muted">
                {profile.hourlyRate}/hr · {profile.skills.join(" · ")}
              </p>
              <Link className="os-link" href="/marketplace/candidate/profile">
                Complete profile →
              </Link>
            </Stack>
          </Card>
        </div>

        <section>
          <div className="marketplace-page-header">
            <div>
              <span className="label text-primary">DISCOVERY</span>
              <h2 className="h2">Rooms worth a look</h2>
            </div>
            <Link className="os-link" href="/marketplace/jobs">
              Open marketplace →
            </Link>
          </div>
          {rooms.length ? (
            <div className="marketplace-dashboard-room-list">
              {rooms.slice(0, 3).map((room) => (
                <Card key={room.id} raised>
                  <div className="marketplace-dashboard-list-row">
                    <div>
                      <strong className="body-strong">{room.title}</strong>
                      <span className="caption text-ink-muted">
                        {room.budgetType}: {room.rateOrBudgetRangeText} ·{" "}
                        {room.experienceLevelRequired}
                      </span>
                    </div>
                    <span className="caption text-ink-muted">{room.proposalsCountText}</span>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No recommendations yet"
              description="Try the marketplace filters to discover more project rooms."
            />
          )}
        </section>
      </Stack>
    </PageBody>
  );
}
