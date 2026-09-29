"use client";

import { useEffect, useState } from "react";
import {
  Button,
  EmptyState,
  Glyph,
  GridColumn,
  GridSystem,
  Stack,
  Timeline,
} from "@openseat/design-system";
import { JobsPipeline } from "@/components/company/overview/jobs-pipeline";
import { NeedsAttention } from "@/components/company/overview/needs-attention";
import { UpcomingInterviews } from "@/components/company/overview/upcoming-interviews";
import { WorkspaceHero } from "@/components/company/overview/workspace-hero";
import { SpendSummary } from "@/components/company/spend-summary";
import { SectionCard } from "@/components/section-card";
import { StatGrid } from "@/components/stat-card";
import { fetchOverview, type CompanyOverview } from "@/lib/company/api";
import { pipelineTotal } from "@/lib/company";
import type { AuthCompany } from "@/lib/auth/types";
import { daysBetween, formatAgo } from "@/lib/dates";
import { ROUTES } from "@/lib/routes";

const WEEK_DAYS = 7;
const PERCENT = 100;

function stats(overview: CompanyOverview) {
  const now = new Date();
  const open = overview.jobs.filter((job) => job.status === "open");
  const thisWeek = overview.applicants.filter(
    (person) => daysBetween(person.appliedOn, now) < WEEK_DAYS,
  );
  const upcoming = overview.interviews.filter((item) => {
    const days = daysBetween(now, item.date);
    return days >= 0 && days < WEEK_DAYS;
  });
  const held = overview.interviews.filter(
    (item) => item.status === "attended" || item.status === "no-show",
  );
  const attended = held.filter((item) => item.status === "attended").length;
  const inPipeline = open.reduce((sum, job) => sum + pipelineTotal(job.pipeline), 0);
  return [
    {
      label: "Open jobs",
      value: String(open.length),
      hint: `${overview.jobs.length} jobs in total`,
    },
    {
      label: "New applicants",
      value: String(thisWeek.length),
      hint: `This week · ${inPipeline} in pipelines`,
    },
    { label: "Interviews", value: String(upcoming.length), hint: "In the next 7 days" },
    {
      label: "Attendance",
      value: `${held.length === 0 ? 0 : Math.round((attended / held.length) * PERCENT)}%`,
      hint: "A no-show returns the price to your balance",
    },
  ];
}

/** Live hiring home: jobs, applicants, interviews, and the purchase balance. */
export function CompanyHome({ greeting, company }: { greeting: string; company: AuthCompany }) {
  const [overview, setOverview] = useState<CompanyOverview | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetchOverview()
      .then((next) => {
        if (active) setOverview(next);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (failed) {
    return (
      <EmptyState
        title="Couldn’t load the workspace"
        description="Refresh the page once the hiring API is running."
      />
    );
  }
  if (!overview) return null;

  return (
    <Stack gap={6}>
      <WorkspaceHero greeting={greeting} company={company} />
      <StatGrid stats={stats(overview)} />
      <GridSystem gap={6} align="start">
        <GridColumn span="full" lg={7}>
          <Stack gap={6}>
            <NeedsAttention
              applicants={overview.applicants}
              interviews={overview.interviews}
              jobs={overview.jobs}
              billing={overview.billing}
            />
            <JobsPipeline jobs={overview.jobs} />
          </Stack>
        </GridColumn>
        <GridColumn span="full" lg={5}>
          <Stack gap={6}>
            <UpcomingInterviews interviews={overview.interviews} />
            <SectionCard
              title="Balance"
              action={
                <Button
                  label="Billing"
                  variant="ghost"
                  size="sm"
                  href={ROUTES.companyBilling}
                  icon={<Glyph name="arrowRight" />}
                />
              }
            >
              <SpendSummary billing={overview.billing} />
            </SectionCard>
            <SectionCard title="Recent activity">
              {overview.activity.length === 0 ? (
                <EmptyState
                  isCompact
                  title="No activity yet"
                  description="Post a job or add balance and it will show up here."
                />
              ) : (
                <Timeline
                  label="Recent activity"
                  variant="compact"
                  items={overview.activity.map((item) => ({
                    id: item.id,
                    title: item.title,
                    description: item.description,
                    time: formatAgo(item.createdAt),
                    tone: item.tone,
                  }))}
                />
              )}
            </SectionCard>
          </Stack>
        </GridColumn>
      </GridSystem>
    </Stack>
  );
}
