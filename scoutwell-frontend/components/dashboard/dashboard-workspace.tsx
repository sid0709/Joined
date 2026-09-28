"use client";

import {
  Button,
  Card,
  Glyph,
  GridColumn,
  GridSystem,
  HStack,
  Stack,
  Text,
  Timeline,
} from "@openseat/design-system";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatGrid } from "@/components/stat-card";
import { SubmissionStatusBadge } from "@/components/status-badge";
import { LEVELS } from "@/lib/config";
import { relativeDay } from "@/lib/dates";
import { formatCount } from "@/lib/format";
import { formatCents } from "@/lib/money";
import { ROUTES } from "@/lib/routes";
import { useScout } from "@/lib/scout-store";
import { dashboardStats, ownedBy } from "@/lib/stats";
import { percent } from "@/lib/format";

const ICON_TILE = 36;

export function DashboardWorkspace() {
  const { user, state } = useScout();
  if (!user) return null;
  const submissions = ownedBy(state.submissions, user.id);
  const earnings = ownedBy(state.earnings, user.id);
  const notifications = ownedBy(state.notifications, user.id);
  const stats = dashboardStats(user, submissions, earnings, notifications);
  const recent = [...submissions]
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .slice(0, 5);
  const review = submissions.filter((item) => item.status === "needs_review");
  const payoutReady = stats.totals.releasedCents;

  return (
    <Stack gap={6}>
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        description="You earn when job hunters and bidders actually use the jobs you submit."
        action={<Button label="Submit a job" variant="primary" href={ROUTES.submit} />}
      />
      <StatGrid
        stats={[
          {
            label: "Live scouted jobs",
            value: String(stats.liveJobs),
            hint: `${formatCount(stats.applications, "application")} · ${formatCount(stats.interviews, "interview")}`,
          },
          {
            label: "Held",
            value: formatCents(stats.totals.heldCents),
            hint: "Releases after the hold window",
          },
          {
            label: "Ready to pay",
            value: formatCents(payoutReady),
            hint: "Released, not yet transferred",
          },
          {
            label: "Today's cap",
            value: `${stats.metrics.submittedToday}/${stats.metrics.dailyLimit}`,
            hint: `${LEVELS[user.level].label} · ${stats.metrics.remainingToday} left`,
          },
        ]}
      />
      <GridSystem gap={6} align="start">
        <GridColumn span="full" lg={7}>
          <Stack gap={6}>
            {review.length > 0 ? (
              <SectionCard
                title="Needs review"
                description="Probation and flagged jobs wait on a moderator before they enter the pool."
              >
                <Stack gap={4}>
                  {review.map((item) => (
                    <HStack key={item.id} hAlign="between" vAlign="center" gap={3} wrap="wrap">
                      <Stack gap={0.5}>
                        <Text weight="medium">{item.title}</Text>
                        <Text type="supporting" color="secondary">
                          {item.companyName} · {relativeDay(item.submittedAt)}
                        </Text>
                      </Stack>
                      <Button
                        label="Open"
                        variant="ghost"
                        size="sm"
                        href={ROUTES.submission(item.id)}
                      />
                    </HStack>
                  ))}
                </Stack>
              </SectionCard>
            ) : null}
            <SectionCard
              title="Recent submissions"
              action={<Button label="All" variant="ghost" size="sm" href={ROUTES.submissions} />}
            >
              <Stack gap={4}>
                {recent.map((item) => (
                  <HStack key={item.id} hAlign="between" vAlign="center" gap={3} wrap="wrap">
                    <HStack gap={3} vAlign="center">
                      <Card variant="blue" padding={0} width={ICON_TILE} height={ICON_TILE}>
                        <Stack hAlign="center" vAlign="center" height="100%">
                          <Text color="accent">
                            <Glyph name="file" />
                          </Text>
                        </Stack>
                      </Card>
                      <Stack gap={0.5}>
                        <Text weight="medium">{item.title}</Text>
                        <Text type="supporting" color="secondary">
                          {item.companyName} · {formatCount(item.interviews, "interview")}
                        </Text>
                      </Stack>
                    </HStack>
                    <SubmissionStatusBadge status={item.status} />
                  </HStack>
                ))}
              </Stack>
            </SectionCard>
          </Stack>
        </GridColumn>
        <GridColumn span="full" lg={5}>
          <Stack gap={6}>
            <SectionCard
              title="Quality"
              action={<Button label="Level" variant="ghost" size="sm" href={ROUTES.level} />}
            >
              <Stack gap={3}>
                <Text>
                  Approval rate{" "}
                  {percent(stats.metrics.approved, stats.metrics.approved + stats.metrics.rejected)}
                  %
                </Text>
                <Text type="supporting" color="secondary" display="block">
                  {formatCount(stats.metrics.withInterview, "job")} produced at least one interview.
                  Volume does not pay; this ratio does.
                </Text>
              </Stack>
            </SectionCard>
            <SectionCard title="Activity">
              <Timeline
                label="Recent activity"
                variant="compact"
                items={notifications.slice(0, 5).map((item) => ({
                  id: item.id,
                  title: item.title,
                  description: item.description,
                  time: relativeDay(item.createdAt),
                  tone:
                    item.tone === "danger"
                      ? "danger"
                      : item.tone === "warning"
                        ? "warning"
                        : "accent",
                }))}
              />
            </SectionCard>
          </Stack>
        </GridColumn>
      </GridSystem>
    </Stack>
  );
}
