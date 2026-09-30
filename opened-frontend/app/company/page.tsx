import type { Metadata } from "next";
import { Button, GridColumn, GridSystem, Glyph, Stack, Timeline } from "@openseat/design-system";
import { JobsPipeline } from "@/components/company/overview/jobs-pipeline";
import { NeedsAttention } from "@/components/company/overview/needs-attention";
import { UpcomingInterviews } from "@/components/company/overview/upcoming-interviews";
import { WorkspaceHero } from "@/components/company/overview/workspace-hero";
import { SpendSummary } from "@/components/company/spend-summary";
import { SectionCard } from "@/components/section-card";
import { StatGrid } from "@/components/stat-card";
import {
  ACTIVITY,
  APPLICANTS,
  COMPANY_INTERVIEWS,
  COMPANY_JOBS,
  pipelineTotal,
} from "@/lib/company";
import { loadSession } from "@/lib/auth/session";
import { daysBetween } from "@/lib/dates";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "Hiring" };

const WEEK_DAYS = 7;
const PERCENT = 100;

function stats() {
  const now = new Date();
  const open = COMPANY_JOBS.filter((job) => job.status === "open");
  const thisWeek = APPLICANTS.filter((person) => daysBetween(person.appliedOn, now) < WEEK_DAYS);
  const upcoming = COMPANY_INTERVIEWS.filter((item) => {
    const days = daysBetween(now, item.date);
    return days >= 0 && days < WEEK_DAYS;
  });
  const held = COMPANY_INTERVIEWS.filter(
    (item) => item.status === "attended" || item.status === "no-show",
  );
  const attended = held.filter((item) => item.status === "attended").length;
  return [
    {
      label: "Open jobs",
      value: String(open.length),
      hint: `${COMPANY_JOBS.length} jobs in total`,
    },
    {
      label: "New applicants",
      value: String(thisWeek.length),
      hint: `This week · ${open.reduce((sum, job) => sum + pipelineTotal(job.pipeline), 0)} in pipelines`,
    },
    { label: "Interviews", value: String(upcoming.length), hint: "In the next 7 days" },
    {
      label: "Attendance",
      value: `${held.length === 0 ? 0 : Math.round((attended / held.length) * PERCENT)}%`,
      hint: "You only pay when they attend",
    },
  ];
}

export default async function CompanyHomePage() {
  const session = await loadSession();
  const company = session?.company;
  const firstName = session?.user.name.split(" ")[0] ?? "there";
  if (!company) return null;

  return (
    <Stack gap={6}>
      <WorkspaceHero greeting={`Welcome back, ${firstName}`} company={company} />
      <StatGrid stats={stats()} />
      <GridSystem gap={6} align="start">
        <GridColumn span="full" lg={7}>
          <Stack gap={6}>
            <NeedsAttention />
            <JobsPipeline />
          </Stack>
        </GridColumn>
        <GridColumn span="full" lg={5}>
          <Stack gap={6}>
            <UpcomingInterviews />
            <SectionCard
              title="Spend"
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
              <SpendSummary />
            </SectionCard>
            <SectionCard title="Recent activity">
              <Timeline
                label="Recent activity"
                variant="compact"
                items={ACTIVITY.map((item) => ({
                  id: item.id,
                  title: item.title,
                  description: item.description,
                  time: item.when,
                  tone: item.tone,
                }))}
              />
            </SectionCard>
          </Stack>
        </GridColumn>
      </GridSystem>
    </Stack>
  );
}
