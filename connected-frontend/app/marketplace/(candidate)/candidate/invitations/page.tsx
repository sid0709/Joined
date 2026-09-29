"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useMockAuth } from "@/src/shared/auth/MockAuthContext";
import { useJobRoomsContext } from "@/src/shared/job-rooms/JobRoomsContext";
import { Badge, Button, Card, EmptyState, PageBody, Stack } from "@/src/shared/marketplace-ui";
import { ProposalStatus } from "@/src/shared/types/job-room";

type InvitationFilter = "All" | "Pending" | "Accepted" | "Declined";
const invitationStatus: ProposalStatus[] = ["Invited", "In Discussion", "Rejected"];

function statusForFilter(status: ProposalStatus, filter: InvitationFilter) {
  if (filter === "All") return invitationStatus.includes(status);
  if (filter === "Pending") return status === "Invited";
  if (filter === "Accepted") return status === "In Discussion";
  return status === "Rejected";
}

export default function CandidateInvitationsPage() {
  const { currentUser } = useMockAuth();
  const { allRooms, applicationsRegistry, respondToInvitation } = useJobRoomsContext();
  const candidateId = currentUser?.email ?? "logged-in-user";
  const [filter, setFilter] = useState<InvitationFilter>("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const invitations = useMemo(
    () =>
      allRooms.flatMap((room) => {
        const proposal = applicationsRegistry[room.id]?.proposals.find(
          (item) => item.id === candidateId && invitationStatus.includes(item.status),
        );
        return proposal ? [{ room, proposal }] : [];
      }),
    [allRooms, applicationsRegistry, candidateId],
  );
  const filteredInvitations = invitations.filter(({ proposal }) =>
    statusForFilter(proposal.status, filter),
  );
  const selected =
    filteredInvitations.find(({ room }) => room.id === selectedId) ?? filteredInvitations[0];
  const pendingCount = invitations.filter(({ proposal }) => proposal.status === "Invited").length;
  const acceptedCount = invitations.filter(
    ({ proposal }) => proposal.status === "In Discussion",
  ).length;

  return (
    <PageBody>
      <Stack gap={24}>
        <div className="marketplace-page-header marketplace-page-intro">
          <div>
            <span className="label text-primary">BIDDER WORKSPACE</span>
            <h1 className="h1">Invitations</h1>
            <p className="body text-ink-muted">
              Review direct requests from job hunters who found your profile. Each invitation
              includes the job context, trust signals, evaluation plan, and next action.
            </p>
          </div>
          <Badge label={`${pendingCount} pending`} tone={pendingCount ? "primary" : "neutral"} />
        </div>
        <div className="marketplace-dashboard-stats">
          <Card>
            <strong className="marketplace-dashboard-stat-value">{invitations.length}</strong>
            <span className="caption">Total invitations</span>
          </Card>
          <Card>
            <strong className="marketplace-dashboard-stat-value">{pendingCount}</strong>
            <span className="caption">Need your response</span>
          </Card>
          <Card>
            <strong className="marketplace-dashboard-stat-value">{acceptedCount}</strong>
            <span className="caption">Conversations started</span>
          </Card>
        </div>
        <Card title="Next step after accepting" meta="Invitations and Messages are connected">
          <div className="marketplace-card-footer">
            <p className="body-sm text-ink-muted">
              Accept a job hunter’s invitation, then open Messages to chat about the brief, rate,
              timeline, evaluation, and milestones.
            </p>
            <Link className="os-link" href="/marketplace/messages">
              Go to Messages →
            </Link>
          </div>
        </Card>
        <div className="marketplace-page-toolbar">
          <div className="marketplace-inline-actions">
            {(["All", "Pending", "Accepted", "Declined"] as InvitationFilter[]).map((option) => (
              <Button
                key={option}
                type="button"
                variant={filter === option ? "primary" : "secondary"}
                onClick={() => setFilter(option)}
              >
                {option}
              </Button>
            ))}
          </div>
          <Link className="os-link" href="/marketplace/candidate/profile">
            Update public profile →
          </Link>
        </div>
        {!invitations.length ? (
          <div className="marketplace-dashboard-grid">
            <Card
              title="No direct invitations yet"
              meta="Your public profile is the source of discovery"
            >
              <EmptyState
                title="Waiting for a job hunter"
                description="Keep your skills, performance score, availability, and work examples current. When a job hunter is interested, their request will appear here."
              />
              <Button href="/marketplace/candidate/profile" variant="primary">
                Improve bidder profile
              </Button>
            </Card>
            <Card title="What an invitation contains" meta="Every request should be decision-ready">
              <div className="marketplace-review-list">
                <div>
                  <strong className="body-strong">Job brief</strong>
                  <p className="body-sm text-ink-muted">
                    Scope, expected outcome, rate range, and timeline.
                  </p>
                </div>
                <div>
                  <strong className="body-strong">Client trust</strong>
                  <p className="body-sm text-ink-muted">
                    Identity, payment, organization, and hiring context.
                  </p>
                </div>
                <div>
                  <strong className="body-strong">Next step</strong>
                  <p className="body-sm text-ink-muted">
                    Accept, decline, message, or schedule an evaluation.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        ) : !filteredInvitations.length ? (
          <Card>
            <EmptyState
              title={`No ${filter.toLowerCase()} invitations`}
              description="Choose another filter to see the rest of your invitation history."
            />
          </Card>
        ) : (
          <div className="marketplace-applications-shell">
            <Card
              title="Invitation inbox"
              meta="Select an invitation to review its complete context"
            >
              <div className="marketplace-selection-list">
                {filteredInvitations.map(({ room, proposal }) => (
                  <button
                    key={room.id}
                    type="button"
                    className={`marketplace-selection-item ${selected?.room.id === room.id ? "marketplace-selection-item-active" : ""}`}
                    onClick={() => setSelectedId(room.id)}
                  >
                    <span>
                      <strong className="body-strong marketplace-truncate">{room.title}</strong>
                      <span className="caption text-ink-muted">
                        {proposal.candidateRate} · {proposal.estimatedTimelineText}
                      </span>
                    </span>
                    <Badge
                      label={proposal.status}
                      tone={
                        proposal.status === "In Discussion"
                          ? "success"
                          : proposal.status === "Rejected"
                            ? "neutral"
                            : "primary"
                      }
                    />
                  </button>
                ))}
              </div>
            </Card>
            {selected && (
              <Card
                title={selected.room.title}
                meta={`Invitation from the job hunter · ${selected.room.postedTimeText}`}
              >
                <Stack gap={16}>
                  <div className="marketplace-message-context-grid">
                    <Card title="Engagement" meta="What the client is asking for">
                      <p className="body-sm">{selected.room.descriptionParagraph}</p>
                      <div className="marketplace-message-facts">
                        <span>{selected.room.rateOrBudgetRangeText}</span>
                        <span>{selected.room.durationEstimateText}</span>
                        <span>{selected.room.weeklyCommitmentText}</span>
                      </div>
                    </Card>
                    <Card title="Job hunter trust" meta="Signals to review before accepting">
                      <div className="marketplace-trust-list">
                        <div>
                          <span>Payment</span>
                          <Badge
                            label={selected.room.isPaymentVerified ? "Verified" : "Not verified"}
                            tone={selected.room.isPaymentVerified ? "success" : "neutral"}
                          />
                        </div>
                        <div>
                          <span>Client rating</span>
                          <strong>
                            {selected.room.clientRating
                              ? `${selected.room.clientRating}/5`
                              : "New client"}
                          </strong>
                        </div>
                        <div>
                          <span>History</span>
                          <strong>{selected.room.clientTotalSpentText}</strong>
                        </div>
                        <div>
                          <span>Location</span>
                          <strong>{selected.room.clientLocationCode}</strong>
                        </div>
                      </div>
                    </Card>
                  </div>
                  <div className="marketplace-tag-list">
                    {selected.room.skillsTags.map((skill) => (
                      <Badge key={skill} label={skill} tone="neutral" />
                    ))}
                  </div>
                  <Card title="Your response" meta="Respond before the invitation expires">
                    <p className="body-sm">
                      Your current terms: {selected.proposal.candidateRate} ·{" "}
                      {selected.proposal.availabilityText}
                    </p>
                    <p className="body-sm text-ink-muted">
                      After accepting, continue in Messages to clarify the brief and use Calendar to
                      schedule an interview or performance test.
                    </p>
                    <div className="marketplace-inline-actions">
                      {selected.proposal.status === "Invited" && (
                        <>
                          <Button
                            type="button"
                            variant="primary"
                            onClick={() =>
                              respondToInvitation(selected.room.id, selected.proposal.id, "accept")
                            }
                          >
                            Accept invitation
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                              respondToInvitation(selected.room.id, selected.proposal.id, "decline")
                            }
                          >
                            Decline
                          </Button>
                        </>
                      )}
                      {selected.proposal.status === "In Discussion" && (
                        <Badge label="Accepted · conversation open" tone="success" />
                      )}
                      {selected.proposal.status === "Rejected" && (
                        <Badge label="Declined" tone="neutral" />
                      )}
                      <Link className="os-link" href="/marketplace/messages">
                        Open messages →
                      </Link>
                      <Link className="os-link" href="/marketplace/candidate/calendar">
                        View calendar →
                      </Link>
                    </div>
                  </Card>
                </Stack>
              </Card>
            )}
          </div>
        )}
      </Stack>
    </PageBody>
  );
}
