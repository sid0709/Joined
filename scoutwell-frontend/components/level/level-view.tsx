import {
  Badge,
  Card,
  Grid,
  HStack,
  Heading,
  Stack,
  Text,
  PageHeader,
  SectionCard,
  StatGrid,
} from "@joined/design-system";
import { LEVEL_BADGE, formatMoney, formatRate, type LevelRule, type Stats } from "@joined/scout";
import { GoalBar } from "@/components/goal-bar";
import { progressTo } from "@/lib/format";

const LEVEL_CARD_MIN = 200;

type Bar = { label: string; value: string; progress: number; met: boolean; note: string };

function bars(stats: Stats): Bar[] {
  const { metrics: m, promotion: p } = stats;
  return [
    {
      label: "Approved jobs",
      value: `${m.approved} / ${p.min_approved}`,
      progress: progressTo(m.approved, p.min_approved),
      met: m.approved >= p.min_approved,
      note: "Published submissions, all time.",
    },
    {
      label: "Approval rate",
      value: `${formatRate(m.approval_rate)} / ${formatRate(p.min_approval_rate)}`,
      progress: progressTo(m.approval_rate, p.min_approval_rate),
      met: m.approval_rate >= p.min_approval_rate,
      note: "Approved out of approved plus rejected.",
    },
    {
      label: "Jobs with an interview",
      value: `${formatRate(m.interview_producing_rate)} / ${formatRate(p.min_interview_producing_rate)}`,
      progress: progressTo(m.interview_producing_rate, p.min_interview_producing_rate),
      met: m.interview_producing_rate >= p.min_interview_producing_rate,
      note: "Approved jobs where at least one interview settled.",
    },
    {
      label: "Duplicate or expired",
      value: `${formatRate(m.duplicate_expired_rate)} (max ${formatRate(p.max_duplicate_expired_rate)})`,
      progress:
        m.duplicate_expired_rate <= p.max_duplicate_expired_rate
          ? 100
          : progressTo(p.max_duplicate_expired_rate, m.duplicate_expired_rate),
      met: m.duplicate_expired_rate <= p.max_duplicate_expired_rate,
      note: "Keep this low: check the pool before you submit and send live postings.",
    },
  ];
}

function LevelCard({ rule, current }: { rule: LevelRule; current: boolean }) {
  return (
    <Card padding={5} variant={current ? "blue" : "default"}>
      <Stack gap={3}>
        <HStack hAlign="between" vAlign="center">
          <Heading level={3}>{rule.label}</Heading>
          {current ? <Badge label="You" variant={LEVEL_BADGE[rule.id]} /> : null}
        </HStack>
        <Stack gap={1}>
          <Text>{rule.daily_limit} submissions a day</Text>
          <Text type="supporting" color="secondary" display="block">
            {rule.auto_approve
              ? `Auto-approved when checks pass${rule.spot_check_rate > 0 ? `, ${formatRate(rule.spot_check_rate)} spot-checked` : ""}`
              : "A moderator reviews every job"}
          </Text>
          <Text type="supporting" color="secondary" display="block">
            {rule.approval_reward.amount_cents > 0
              ? `${formatMoney(rule.approval_reward)} per approved job`
              : "No approval credit"}{" "}
            · interviews ×{rule.interview_multiplier}
          </Text>
        </Stack>
      </Stack>
    </Card>
  );
}

export function LevelView({ stats, levels }: { stats: Stats; levels: LevelRule[] }) {
  const { metrics, promotion, next_level: next } = stats;
  const decided = metrics.approved + metrics.rejected;

  return (
    <Stack gap={6}>
      <PageHeader
        title="Level & limits"
        description="Your limit and rewards rise with the quality of what you send, never with volume."
        action={<Badge label={stats.level.label} variant={LEVEL_BADGE[stats.level.id]} />}
      />
      <StatGrid
        stats={[
          {
            label: "Today",
            value: `${metrics.submitted_today} / ${metrics.daily_limit}`,
            hint: `${metrics.remaining_today} left, resets midnight UTC`,
          },
          {
            label: "Approval rate",
            value: formatRate(metrics.approval_rate),
            hint: `${metrics.approved} approved of ${decided} decided`,
          },
          {
            label: "Live jobs",
            value: String(metrics.live),
            hint: `${metrics.pending} waiting on checks or review`,
          },
          {
            label: "Approval credit",
            value: formatMoney(stats.level.approval_reward),
            hint: "Per job published at your level",
          },
        ]}
      />
      <SectionCard title="Levels">
        <Grid columns={{ minWidth: LEVEL_CARD_MIN, max: levels.length }} gap={4}>
          {levels.map((rule) => (
            <LevelCard key={rule.id} rule={rule} current={rule.id === stats.level.id} />
          ))}
        </Grid>
      </SectionCard>
      <SectionCard
        title={next ? `Reach ${next.label}` : "Stay at the top"}
        description={
          next
            ? "Clear every bar. Levels recompute after each decision on your jobs."
            : "Falling below these bars moves you back a level."
        }
      >
        <Stack gap={5}>
          {bars(stats).map((bar) => (
            <Stack key={bar.label} gap={1.5}>
              <GoalBar
                label={bar.label}
                progress={bar.progress}
                valueLabel={bar.value}
                variant={bar.met ? "success" : "accent"}
              />
              <Text type="supporting" color="secondary" display="block">
                {bar.note}
              </Text>
            </Stack>
          ))}
          <Text type="supporting" color="secondary" display="block">
            Below {formatRate(promotion.demote_below_approval_rate)} approval after{" "}
            {promotion.demote_min_decided} decided jobs, a level is lost.
            {stats.profile.level_pinned ? " Your level is currently set by staff." : ""}
          </Text>
        </Stack>
      </SectionCard>
    </Stack>
  );
}
