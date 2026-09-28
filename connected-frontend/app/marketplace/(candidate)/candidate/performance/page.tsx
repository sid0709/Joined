"use client";

import Link from "next/link";

import { useMockAuth } from "@/src/shared/auth/MockAuthContext";
import { Badge, Button, Card, PageBody, Stack } from "@/src/shared/marketplace-ui";

function ScoreRow({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="marketplace-performance-row">
      <div className="marketplace-card-footer">
        <strong className="body-strong">{label}</strong>
        <strong>{value}%</strong>
      </div>
      <div className="marketplace-readiness-meter">
        <span style={{ width: `${value}%` }} />
      </div>
      <span className="caption text-ink-muted">{description}</span>
    </div>
  );
}

export default function CandidatePerformancePage() {
  const { profile } = useMockAuth();
  return (
    <PageBody>
      <Stack gap={24}>
        <div className="marketplace-page-header marketplace-page-intro">
          <div>
            <span className="label text-primary">BIDDER PERFORMANCE</span>
            <h1 className="h1">Performance Center</h1>
            <p className="body text-ink-muted">
              This is the evidence job hunters use to decide who to contact, approve, and pay at a
              higher rate.
            </p>
          </div>
          <Badge
            label={profile.verificationStatus}
            tone={profile.verificationStatus === "Verified" ? "success" : "neutral"}
          />
        </div>
        <div className="marketplace-dashboard-stats">
          <Card>
            <strong className="marketplace-dashboard-stat-value">{profile.performanceScore}</strong>
            <span className="caption">Overall performance</span>
          </Card>
          <Card>
            <strong className="marketplace-dashboard-stat-value">
              {profile.schedulingReliability}
            </strong>
            <span className="caption">Scheduling reliability</span>
          </Card>
          <Card>
            <strong className="marketplace-dashboard-stat-value">{profile.hourlyRate}</strong>
            <span className="caption">Current rate</span>
          </Card>
          <Card>
            <strong className="marketplace-dashboard-stat-value">
              {profile.verificationStatus === "Verified" ? "Public" : "In review"}
            </strong>
            <span className="caption">Trust visibility</span>
          </Card>
        </div>
        <div className="marketplace-dashboard-grid">
          <Card
            title="Public performance score"
            meta="A single signal, backed by the details below"
          >
            <div className="marketplace-performance-score">
              <strong>86</strong>
              <span>/ 100</span>
            </div>
            <p className="body-sm text-ink-muted">
              Strong bidder signal. Complete more verified evaluations and successful deliveries to
              improve visibility.
            </p>
            <div className="marketplace-readiness-meter">
              <span style={{ width: "86%" }} />
            </div>
          </Card>
          <Card
            title="What job hunters see"
            meta="Your public profile and performance are connected"
          >
            <div className="marketplace-review-list">
              <div>
                <strong className="body-strong">Specialty</strong>
                <p className="body-sm text-ink-muted">{profile.specialty}</p>
              </div>
              <div>
                <strong className="body-strong">Experience</strong>
                <p className="body-sm text-ink-muted">{profile.yearsExperience}</p>
              </div>
              <div>
                <strong className="body-strong">Availability</strong>
                <p className="body-sm text-ink-muted">
                  {profile.availability} · {profile.timezone}
                </p>
              </div>
            </div>
            <Link className="os-link" href="/marketplace/candidate/profile">
              Edit public profile →
            </Link>
          </Card>
        </div>
        <div className="marketplace-dashboard-grid">
          <Card title="Score breakdown" meta="How your rate and profile visibility are calculated">
            <Stack gap={16}>
              <ScoreRow
                label="Scheduling reliability"
                value={92}
                description="Attendance and response consistency for agreed sessions."
              />
              <ScoreRow
                label="Evaluation completion"
                value={88}
                description="Completed assessments and quality of submitted work."
              />
              <ScoreRow
                label="Delivery quality"
                value={84}
                description="Client reviews, milestone outcomes, and revision history."
              />
              <ScoreRow
                label="Communication"
                value={86}
                description="Clarity and responsiveness inside job-room conversations."
              />
            </Stack>
          </Card>
          <Card
            title="Verification history"
            meta="Verified events are stronger than self-reported claims"
          >
            <div className="marketplace-review-list">
              <div>
                <div className="marketplace-card-footer">
                  <strong className="body-strong">Profile review</strong>
                  <Badge label="In review" tone="neutral" />
                </div>
                <p className="body-sm text-ink-muted">
                  Skills, rate, availability, and work examples.
                </p>
              </div>
              <div>
                <div className="marketplace-card-footer">
                  <strong className="body-strong">Practical evaluation</strong>
                  <Badge label="Not scheduled" tone="neutral" />
                </div>
                <p className="body-sm text-ink-muted">
                  A job hunter may invite you to a test or interview through Messages.
                </p>
              </div>
              <div>
                <div className="marketplace-card-footer">
                  <strong className="body-strong">Delivery review</strong>
                  <Badge label="Waiting for work" tone="neutral" />
                </div>
                <p className="body-sm text-ink-muted">
                  Approved job-room milestones become part of your public trust record.
                </p>
              </div>
            </div>
            <Button href="/marketplace/candidate/invitations" variant="secondary">
              View invitations
            </Button>
          </Card>
        </div>
        <div className="marketplace-dashboard-grid">
          <Card
            title="Rate progression"
            meta="Verified performance can improve your earning potential"
          >
            <div className="marketplace-performance-tiers">
              <div className="marketplace-performance-tier marketplace-performance-tier-current">
                <span>Verified starter</span>
                <strong>$45–$65/hr</strong>
                <Badge label="Current" tone="primary" />
              </div>
              <div className="marketplace-performance-tier">
                <span>Proven specialist</span>
                <strong>$65–$95/hr</strong>
                <Badge label="86+ score" tone="neutral" />
              </div>
              <div className="marketplace-performance-tier">
                <span>Top performer</span>
                <strong>$95+/hr</strong>
                <Badge label="92+ score" tone="neutral" />
              </div>
            </div>
          </Card>
          <Card title="Your next improvement" meta="The fastest way to strengthen your profile">
            <p className="body-md">
              Add two relevant work examples and complete a verified evaluation when invited.
            </p>
            <div className="marketplace-inline-actions">
              <Button href="/marketplace/candidate/profile" variant="primary">
                Complete profile
              </Button>
              <Button href="/marketplace/messages" variant="secondary">
                Open Messages
              </Button>
            </div>
          </Card>
        </div>
      </Stack>
    </PageBody>
  );
}
