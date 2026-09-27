"use client";

import { useMemo, useState } from "react";

import { Badge, Button, Card, Input, PageBody, Stack } from "@/src/shared/marketplace-ui";

type Bidder = {
  id: string;
  name: string;
  title: string;
  specialty: string;
  score: number;
  reliability: number;
  rate: string;
  availability: string;
  location: string;
  skills: string[];
  examples: string[];
  verified: boolean;
};

const bidders: Bidder[] = [
  {
    id: "bidder-alex",
    name: "Alex Miller",
    title: "Direct Response Growth Marketer",
    specialty: "Growth strategy and experimentation",
    score: 92,
    reliability: 96,
    rate: "$65/hr",
    availability: "30+ hrs/week · Starts next Monday",
    location: "HKG · Remote",
    skills: ["Creative Strategy", "Paid Acquisition", "Lifecycle Growth"],
    examples: ["DTC retention relaunch", "Growth experiment system"],
    verified: true,
  },
  {
    id: "bidder-maya",
    name: "Maya Chen",
    title: "Senior Product Designer",
    specialty: "Research-led product systems",
    score: 89,
    reliability: 94,
    rate: "$78/hr",
    availability: "20 hrs/week · Available now",
    location: "USA · ET",
    skills: ["Product Design", "UX Research", "Design Systems"],
    examples: ["B2B workflow redesign", "Mobile onboarding"],
    verified: true,
  },
  {
    id: "bidder-sam",
    name: "Sam Rivera",
    title: "Full-stack Platform Engineer",
    specialty: "Reliable web platforms and integrations",
    score: 86,
    reliability: 91,
    rate: "$72/hr",
    availability: "25 hrs/week · Starts in 2 weeks",
    location: "USA · PT",
    skills: ["Next.js", "TypeScript", "APIs"],
    examples: ["Marketplace platform", "Payments integration"],
    verified: false,
  },
];

export default function ClientBiddersPage() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(bidders[0].id);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [invitedIds, setInvitedIds] = useState<string[]>([]);
  const selected = bidders.find((bidder) => bidder.id === selectedId) ?? bidders[0];
  const visible = useMemo(
    () =>
      bidders.filter((bidder) =>
        `${bidder.name} ${bidder.title} ${bidder.skills.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [query],
  );
  const toggleCompare = (id: string) =>
    setCompareIds((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id].slice(-3),
    );

  return (
    <PageBody>
      <Stack gap={24}>
        <div className="marketplace-page-header marketplace-page-intro">
          <div>
            <span className="label text-primary">CLIENT WORKSPACE</span>
            <h1 className="h1">Bidder directory</h1>
            <p className="body text-ink-muted">
              Find bidders by verified performance, scheduling reliability, skills, rate, and
              availability. Select a profile to invite them into a job conversation or evaluation.
            </p>
          </div>
          <Badge label={`${bidders.length} profiles`} tone="neutral" />
        </div>
        <div className="marketplace-page-toolbar">
          <Input
            label="Search bidders"
            placeholder="Name, skill, specialty, or technology"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="marketplace-inline-actions">
            <Button href="/marketplace/client/jobs/new" variant="primary">
              Create job room
            </Button>
            <Button href="/marketplace/client/applications" variant="secondary">
              Review applications
            </Button>
          </div>
        </div>
        <div className="marketplace-dashboard-stats">
          <Card>
            <strong className="marketplace-dashboard-stat-value">{bidders.length}</strong>
            <span className="caption">Visible bidders</span>
          </Card>
          <Card>
            <strong className="marketplace-dashboard-stat-value">
              {bidders.filter((bidder) => bidder.verified).length}
            </strong>
            <span className="caption">Verified profiles</span>
          </Card>
          <Card>
            <strong className="marketplace-dashboard-stat-value">{compareIds.length}</strong>
            <span className="caption">Selected to compare</span>
          </Card>
          <Card>
            <strong className="marketplace-dashboard-stat-value">{invitedIds.length}</strong>
            <span className="caption">Invited from here</span>
          </Card>
        </div>
        <div className="marketplace-applications-shell">
          <Card
            title="Bidder profiles"
            meta="Public profiles expose capability before you start a conversation"
          >
            <div className="marketplace-selection-list">
              {visible.map((bidder) => (
                <button
                  key={bidder.id}
                  type="button"
                  className={`marketplace-selection-item ${selected.id === bidder.id ? "marketplace-selection-item-active" : ""}`}
                  onClick={() => setSelectedId(bidder.id)}
                >
                  <span>
                    <strong className="body-strong">{bidder.name}</strong>
                    <span className="caption text-ink-muted">{bidder.title}</span>
                  </span>
                  <span className="marketplace-inline-actions">
                    <Badge label={`${bidder.score}/100`} tone="success" />
                    {bidder.verified && <Badge label="Verified" tone="primary" />}
                  </span>
                </button>
              ))}
              {!visible.length && (
                <p className="body-sm text-ink-muted">No bidder profiles match your search.</p>
              )}
            </div>
          </Card>
          <Card title={selected.name} meta={selected.title}>
            <Stack gap={16}>
              <div className="marketplace-page-header">
                <div>
                  <span className="eyebrow">{selected.specialty}</span>
                  <p className="body-sm text-ink-muted">{selected.location}</p>
                </div>
                <Badge
                  label={selected.verified ? "Identity verified" : "Verification pending"}
                  tone={selected.verified ? "success" : "neutral"}
                />
              </div>
              <div className="marketplace-dashboard-stats">
                <div>
                  <strong className="marketplace-dashboard-stat-value">{selected.score}</strong>
                  <span className="caption">Performance</span>
                </div>
                <div>
                  <strong className="marketplace-dashboard-stat-value">
                    {selected.reliability}%
                  </strong>
                  <span className="caption">Scheduling</span>
                </div>
              </div>
              <p className="body-strong">
                {selected.rate} · {selected.availability}
              </p>
              <div className="marketplace-tag-list">
                {selected.skills.map((skill) => (
                  <Badge key={skill} label={skill} tone="neutral" />
                ))}
              </div>
              <div>
                <span className="eyebrow">Relevant work</span>
                {selected.examples.map((example) => (
                  <p key={example} className="body-sm text-ink-muted">
                    {example}
                  </p>
                ))}
              </div>
              <div className="marketplace-inline-actions">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() =>
                    setInvitedIds((ids) =>
                      ids.includes(selected.id) ? ids : [...ids, selected.id],
                    )
                  }
                >
                  {invitedIds.includes(selected.id) ? "Invitation sent" : "Invite bidder"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => toggleCompare(selected.id)}
                >
                  {compareIds.includes(selected.id) ? "Remove from compare" : "Compare bidder"}
                </Button>
              </div>
            </Stack>
          </Card>
        </div>
        {compareIds.length > 0 && (
          <Card
            title="Bidder comparison"
            meta="Compare the same decision signals before you invite"
          >
            <div className="marketplace-comparison-grid">
              {bidders
                .filter((bidder) => compareIds.includes(bidder.id))
                .map((bidder) => (
                  <div key={bidder.id} className="marketplace-comparison-column">
                    <strong className="body-strong">{bidder.name}</strong>
                    <p className="body-sm text-ink-muted">{bidder.title}</p>
                    <p className="body-sm">Performance: {bidder.score}/100</p>
                    <p className="body-sm">Scheduling: {bidder.reliability}%</p>
                    <p className="body-sm">Rate: {bidder.rate}</p>
                    <p className="body-sm">Availability: {bidder.availability}</p>
                  </div>
                ))}
            </div>
          </Card>
        )}
      </Stack>
    </PageBody>
  );
}
