import {
  Badge,
  Banner,
  Button,
  GridColumn,
  GridSystem,
  HStack,
  Stack,
  Text,
  Timeline,
  SectionCard,
  StatGrid,
} from "@openseat/design-system";
import {
  LEVEL_BADGE,
  formatRate,
  type ScoutNotification,
  type Stats,
  type Submission,
} from "@openseat/scout";
import { GoalBar } from "@/components/goal-bar";
import { EarningsHero } from "./earnings-hero";
import { SubmissionTable } from "@/components/submissions/submission-table";
import { formatDay, greeting, relativeDay } from "@/lib/dates";
import { formatCount, progressTo } from "@/lib/format";
import { ROUTES } from "@/lib/routes";

export function DashboardView({
  stats,
  recent,
  activity,
}: {
  stats: Stats;
  recent: Submission[];
  activity: ScoutNotification[];
}) {
  const { profile, metrics, balance, quota, promotion } = stats;
  const firstName = profile.name.split(" ")[0] ?? profile.name;
  const available = balance.released.amount_cents;
  const usedToday = quota.limit - quota.remaining;

  return (
    <Stack gap={6}>
      <div className="sw-rise">
        <EarningsHero
          greeting={`${greeting()}, ${firstName}`}
          balance={balance}
          payoutReady={stats.payout.ready}
          note={
            available > 0 && !stats.payout.ready
              ? `To pay out, finish ${stats.payout.blockers.join(" and ").toLowerCase()}.`
              : undefined
          }
        />
      </div>

      {quota.remaining === 0 ? (
        <Banner
          status="info"
          title="You used today's submissions"
          description={`Your ${stats.level.label} limit is ${quota.limit} a day. It resets at midnight UTC.`}
        />
      ) : null}

      <StatGrid
        stats={[
          {
            label: "Live jobs",
            value: String(metrics.live),
            hint: `${formatCount(stats.activity.applications, "application")} · ${formatCount(stats.activity.interviews, "interview")}`,
          },
          {
            label: "In review",
            value: String(metrics.pending),
            hint: `${formatCount(metrics.approved, "approved job")} so far`,
          },
          {
            label: "Approval rate",
            value: formatRate(metrics.approval_rate),
            hint: `Interviews on ${formatRate(metrics.interview_producing_rate)} of jobs`,
          },
          {
            label: "Today",
            value: `${usedToday} / ${quota.limit}`,
            hint: `${formatCount(quota.remaining, "submission")} left`,
          },
        ]}
      />

      <GridSystem gap={6} align="start">
        <GridColumn span="full" lg={7}>
          <SectionCard
            title="Recent submissions"
            description="Checks run in the background; open one to see why it landed where it did."
            action={<Button label="View all" variant="ghost" size="sm" href={ROUTES.submissions} />}
          >
            <SubmissionTable
              rows={recent}
              caption="Recent submissions"
              compact
              empty={{
                title: "Nothing submitted yet",
                description:
                  "Find an opening on a company careers page or ATS and submit its link.",
              }}
            />
          </SectionCard>
        </GridColumn>
        <GridColumn span="full" lg={5}>
          <Stack gap={6}>
            <SectionCard
              title="Your level"
              action={<Button label="Details" variant="ghost" size="sm" href={ROUTES.level} />}
            >
              <Stack gap={4}>
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <Badge label={stats.level.label} variant={LEVEL_BADGE[stats.level.id]} />
                  <Text type="supporting" color="secondary">
                    {stats.level.auto_approve
                      ? "Clean submissions publish automatically"
                      : "A moderator reviews each submission"}
                  </Text>
                </HStack>
                {stats.next_level ? (
                  <Stack gap={3}>
                    <GoalBar
                      label={`Approved jobs toward ${stats.next_level.label}`}
                      progress={progressTo(metrics.approved, promotion.min_approved)}
                      valueLabel={`${metrics.approved} / ${promotion.min_approved}`}
                      variant={metrics.approved >= promotion.min_approved ? "success" : "accent"}
                    />
                    <Text type="supporting" color="secondary" display="block">
                      Approval rate {formatRate(metrics.approval_rate)} (needs{" "}
                      {formatRate(promotion.min_approval_rate)}). Jobs with interviews{" "}
                      {formatRate(metrics.interview_producing_rate)} (needs{" "}
                      {formatRate(promotion.min_interview_producing_rate)}).
                    </Text>
                  </Stack>
                ) : (
                  <Text type="supporting" color="secondary" display="block">
                    Top level. Stay above the quality bars to keep it.
                  </Text>
                )}
              </Stack>
            </SectionCard>
            <SectionCard
              title="Activity"
              action={<Button label="All" variant="ghost" size="sm" href={ROUTES.notifications} />}
            >
              {activity.length === 0 ? (
                <Text color="secondary" display="block">
                  Decisions, rewards, and level changes show up here.
                </Text>
              ) : (
                <Timeline
                  label="Recent activity"
                  variant="compact"
                  items={activity.map((item) => ({
                    id: item.id,
                    title: item.title,
                    description: item.body,
                    time:
                      relativeDay(item.created_at) === "Today"
                        ? "Today"
                        : formatDay(item.created_at),
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
