"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useClientDashboard } from "@/src/client/hooks/useClientDashboard";
import { JobRoomCard } from "@/src/shared/components/JobRoomCard";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageBody,
  Stack,
} from "@/src/shared/marketplace-ui";

export function ClientJobsView() {
  const { clientRooms, applicationsRegistry } = useClientDashboard();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Open" | "Reviewing" | "Awarded">("All");
  const visibleRooms = useMemo(
    () =>
      clientRooms.filter((room) => {
        const workflowStatus = applicationsRegistry[room.id]?.workStatus ?? "Open";
        const matchesQuery =
          `${room.title} ${room.descriptionParagraph} ${room.skillsTags.join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase());
        const matchesStatus = statusFilter === "All" || workflowStatus === statusFilter;
        return matchesQuery && matchesStatus;
      }),
    [applicationsRegistry, clientRooms, query, statusFilter],
  );
  const proposalCount = clientRooms.reduce(
    (total, room) => total + (applicationsRegistry[room.id]?.proposals.length ?? 0),
    0,
  );
  const activeCount = clientRooms.filter((room) =>
    ["Awarded", "In Progress", "In Review"].includes(
      applicationsRegistry[room.id]?.workStatus ?? "Open",
    ),
  ).length;
  return (
    <PageBody>
      <Stack gap={24}>
        <div className="marketplace-page-header marketplace-page-intro">
          <div>
            <span className="label text-primary">CLIENT WORKSPACE</span>
            <h1 className="h1">Jobs</h1>
            <p className="body text-ink-muted">
              Manage external company job links, assign bidders, review application activity, and
              track interview outcomes.
            </p>
          </div>
          <Button href="/marketplace/client/jobs/new" variant="primary">
            Add job link
          </Button>
        </div>
        <div className="marketplace-dashboard-stats">
          <Card>
            <strong className="marketplace-dashboard-stat-value">{clientRooms.length}</strong>
            <span className="caption">Total job rooms</span>
          </Card>
          <Card>
            <strong className="marketplace-dashboard-stat-value">{proposalCount}</strong>
            <span className="caption">Total proposals</span>
          </Card>
          <Card>
            <strong className="marketplace-dashboard-stat-value">{activeCount}</strong>
            <span className="caption">Managed rooms</span>
          </Card>
          <Card>
            <strong className="marketplace-dashboard-stat-value">
              {clientRooms.filter((room) => room.isPaymentVerified).length}
            </strong>
            <span className="caption">Payment verified</span>
          </Card>
        </div>
        <div className="marketplace-page-toolbar">
          <Input
            label="Search job rooms"
            placeholder="Search title, brief, or skill"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="marketplace-inline-actions">
            {(["All", "Open", "Reviewing", "Awarded"] as const).map((status) => (
              <Button
                key={status}
                type="button"
                variant={statusFilter === status ? "primary" : "secondary"}
                onClick={() => setStatusFilter(status)}
              >
                {status}
              </Button>
            ))}
          </div>
        </div>
        <div className="marketplace-jobs-grid">
          <Stack gap={16}>
            {visibleRooms.map((room) => {
              const workflow = applicationsRegistry[room.id];
              const proposals = workflow?.proposals ?? [];
              const status = workflow?.workStatus ?? "Open";
              return (
                <Stack key={room.id} gap={8}>
                  <JobRoomCard room={room} showBidButton={false} />
                  <Card>
                    <div className="marketplace-card-footer">
                      <div>
                        <Badge
                          label={status}
                          tone={
                            status === "Awarded"
                              ? "success"
                              : status === "Reviewing"
                                ? "primary"
                                : "neutral"
                          }
                        />
                        <span className="caption text-ink-muted">
                          {proposals.length} bidder(s) · {room.sourceCompany ?? "External company"}
                        </span>
                      </div>
                      <div className="marketplace-inline-actions">
                        <Link className="os-link" href="/marketplace/client/applications">
                          Assign / review bidders →
                        </Link>
                        {status === "Awarded" && (
                          <Link className="os-link" href="/marketplace/client/work">
                            Open Managed Work →
                          </Link>
                        )}
                      </div>
                    </div>
                  </Card>
                </Stack>
              );
            })}
            {!visibleRooms.length && (
              <Card>
                <EmptyState
                  title="No job links match"
                  description="Try another search or status filter, or add a new external job link."
                />
              </Card>
            )}
          </Stack>
          <Card
            title="Job-link lifecycle"
            meta="Manage the path from external posting to bidder interview"
          >
            <div className="marketplace-review-list">
              <div>
                <strong className="body-strong">Imported</strong>
                <p className="body-sm text-ink-muted">
                  Company job link and requirements are saved in your pool.
                </p>
              </div>
              <div>
                <strong className="body-strong">Assigned</strong>
                <p className="body-sm text-ink-muted">
                  Relevant bidders receive the job link and application instructions.
                </p>
              </div>
              <div>
                <strong className="body-strong">Interview scheduled</strong>
                <p className="body-sm text-ink-muted">
                  Track the company response and job hunter interview in Calendar.
                </p>
              </div>
            </div>
            <Button href="/marketplace/client/applications" variant="secondary">
              Open bidder applications
            </Button>
          </Card>
        </div>
      </Stack>
    </PageBody>
  );
}
