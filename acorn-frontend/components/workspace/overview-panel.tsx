"use client";

import { useState } from "react";
import {
  BarChart,
  Banner,
  Button,
  DonutChart,
  FunnelChart,
  Glyph,
  GridColumn,
  GridSystem,
  HStack,
  HeatmapCalendar,
  PageHeader,
  SectionCard,
  SegmentedControl,
  SegmentedControlItem,
  Stack,
  Text,
  TrendChart,
} from "@joined/design-system";
import type { AcornAccount } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import type { Activity } from "@/lib/workspace/activity";
import { firstName } from "@/lib/workspace/model";
import { completeness, profileChecklist, sampleProfile } from "@/lib/workspace/profile";
import {
  DEFAULT_RANGE,
  RANGES,
  byWeekday,
  bySource,
  dailyActivity,
  funnel,
  habits,
  previousWindow,
  recentApplications,
  replyRateBySource,
  stageMix,
  summarize,
  upcomingInterviews,
  weekly,
  windowFor,
  type RangeValue,
} from "@/lib/workspace/stats";
import { ComingUp } from "./overview/coming-up";
import { KpiRow } from "./overview/kpi-row";
import { Readiness } from "./overview/readiness";
import { RecentTable } from "./overview/recent-table";
import { useWorkspace } from "./use-workspace";

const RECENT_ROWS = 24;
const percent = (value: number) => `${value}%`;

export function OverviewPanel({
  account,
  activity,
}: {
  account: AcornAccount;
  activity: Activity;
}) {
  const { workspace } = useWorkspace();
  const [range, setRange] = useState<RangeValue>(DEFAULT_RANGE);
  const [sourceView, setSourceView] = useState<"volume" | "rate">("volume");
  const { today, applications } = activity;

  const period = windowFor(range, today);
  const current = summarize(applications, period);
  const previous = summarize(applications, previousWindow(period));
  const trend = weekly(applications, range, today);
  const days = dailyActivity(applications, period);
  const rhythm = habits(days);
  const weekdays = byWeekday(applications, period);
  const busiest = weekdays.reduce(
    (best, day) => (day.value > best.value ? day : best),
    weekdays[0],
  );

  const profile = workspace.profile ?? sampleProfile(account);
  const checklist = profileChecklist(profile);
  const mailboxes = workspace.mailboxes.length;
  const drafts = workspace.resumes.length;

  return (
    <Stack gap={6}>
      <PageHeader
        title={`Welcome back, ${firstName(account.name)}.`}
        description="How your search is going: what Acorn sent, who wrote back, and what comes next."
        action={
          <HStack gap={3} vAlign="center" wrap="wrap">
            <SegmentedControl
              label="Date range"
              value={range}
              onChange={(value) => setRange(value as RangeValue)}
            >
              {RANGES.map((option) => (
                <SegmentedControlItem
                  key={option.value}
                  value={option.value}
                  label={option.label}
                />
              ))}
            </SegmentedControl>
            <Button
              label="New resume"
              variant="primary"
              href={ROUTES.resume}
              icon={<Glyph name="sparkle" />}
            />
          </HStack>
        }
      />
      <Banner
        status="info"
        title="Sample activity"
        description="These numbers are generated until the extension reports your real applications to Acorn."
      />
      <KpiRow current={current} previous={previous} trend={trend} />
      <GridSystem gap={4} align="stretch">
        <GridColumn span="full" lg={8}>
          <SectionCard
            title="Activity over time"
            description="Applications sent, replies received, and interviews, per week."
          >
            <TrendChart
              label="Applications, replies, and interviews per week"
              labels={trend.labels}
              series={[
                { label: "Applied", values: trend.applied },
                { label: "Replies", values: trend.replies },
                { label: "Interviews", values: trend.interviews },
              ]}
              height={260}
            />
          </SectionCard>
        </GridColumn>
        <GridColumn span="full" lg={4}>
          <SectionCard
            title="Where they stand"
            description="Applications sent in this period, by status."
          >
            <DonutChart
              label="Applications by status"
              centerLabel="Applications"
              data={stageMix(applications, period)}
              size={152}
            />
          </SectionCard>
        </GridColumn>
        <GridColumn span="full" lg={7}>
          <SectionCard
            title="Pipeline"
            description="Jobs saved in this period and how far each got. The percentage is from the step above."
          >
            <FunnelChart label="Application pipeline" stages={funnel(applications, period)} />
          </SectionCard>
        </GridColumn>
        <GridColumn span="full" lg={5}>
          <SectionCard
            title="Sources"
            description={
              sourceView === "volume"
                ? "Where Acorn applied."
                : "Share of applications that got a reply."
            }
            action={
              <SegmentedControl
                label="Source measure"
                size="sm"
                value={sourceView}
                onChange={(value) => setSourceView(value as "volume" | "rate")}
              >
                <SegmentedControlItem value="volume" label="Volume" />
                <SegmentedControlItem value="rate" label="Reply rate" />
              </SegmentedControl>
            }
          >
            {sourceView === "volume" ? (
              <BarChart
                label="Applications by source"
                orientation="bars"
                data={bySource(applications, period)}
              />
            ) : (
              <BarChart
                label="Reply rate by source"
                orientation="bars"
                tone="orange"
                data={replyRateBySource(applications, period)}
                formatValue={percent}
              />
            )}
          </SectionCard>
        </GridColumn>
        <GridColumn span="full" lg={8}>
          <SectionCard
            title="Daily rhythm"
            description={`Active on ${rhythm.activeDays} of ${rhythm.totalDays} days · longest streak ${rhythm.bestStreak} days · current streak ${rhythm.currentStreak}`}
          >
            <HeatmapCalendar label="Applications per day" unit="applications" days={days} />
          </SectionCard>
        </GridColumn>
        <GridColumn span="full" lg={4}>
          <SectionCard
            title="By weekday"
            description={
              busiest.value > 0
                ? `${busiest.label} is your busiest day.`
                : "No applications in this period."
            }
          >
            <BarChart label="Applications by weekday" data={weekdays} height={180} />
          </SectionCard>
        </GridColumn>
        <GridColumn span="full" lg={8}>
          <SectionCard
            title="Recent applications"
            description="Newest activity first. Sort any column."
          >
            <RecentTable
              applications={recentApplications(applications, today, RECENT_ROWS)}
              today={today}
            />
          </SectionCard>
        </GridColumn>
        <GridColumn span="full" lg={4}>
          <Stack gap={4}>
            <SectionCard title="Coming up" description="Interviews on the calendar.">
              <ComingUp interviews={upcomingInterviews(applications, today)} today={today} />
            </SectionCard>
            <SectionCard
              title="Ready to apply"
              description="What Acorn fills, attaches, and watches."
            >
              <Readiness
                percent={completeness(checklist)}
                checklist={checklist}
                checks={[
                  {
                    label: "Resume",
                    detail: drafts ? `${drafts} drafts ready to attach` : "No drafts yet",
                    done: drafts > 0,
                    href: ROUTES.resume,
                    action: "Generate",
                  },
                  {
                    label: "Gmail",
                    detail: mailboxes
                      ? `${mailboxes} mailboxes watching replies`
                      : "Replies aren't tracked",
                    done: mailboxes > 0,
                    href: ROUTES.gmail,
                    action: "Connect",
                  },
                ]}
              />
            </SectionCard>
          </Stack>
        </GridColumn>
      </GridSystem>
      <Text type="supporting" color="secondary">
        Figures cover {RANGES.find((option) => option.value === range)?.label.toLowerCase()} ending
        today and compare against the same length of time before it.
      </Text>
    </Stack>
  );
}
