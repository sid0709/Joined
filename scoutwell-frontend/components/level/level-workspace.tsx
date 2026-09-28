"use client";

import { Badge, ProgressBar, Stack, Text } from "@openseat/design-system";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatGrid } from "@/components/stat-card";
import { LEVELS, PROMOTION, type ScoutLevel } from "@/lib/config";
import { percent } from "@/lib/format";
import { formatCents } from "@/lib/money";
import { levelMetrics, meetsPromotion, nextLevel } from "@/lib/levels";
import { approvalRewardCents } from "@/lib/rewards";
import { useScout } from "@/lib/scout-store";
import { ownedBy } from "@/lib/stats";

function barValue(part: number, goal: number) {
  if (goal <= 0) return 0;
  return Math.min(100, percent(part, goal));
}

export function LevelWorkspace() {
  const { user, state } = useScout();
  if (!user) return null;
  const metrics = levelMetrics(user, ownedBy(state.submissions, user.id));
  const upcoming = nextLevel(user.level);
  const ready = meetsPromotion(metrics);

  return (
    <Stack gap={6}>
      <PageHeader
        title="Level & limits"
        description="Daily caps and interview multipliers rise with quality, never with raw volume."
        action={<Badge label={LEVELS[user.level].label} variant="blue" />}
      />
      <StatGrid
        stats={[
          {
            label: "Today",
            value: `${metrics.submittedToday}/${metrics.dailyLimit}`,
            hint: `${metrics.remainingToday} submissions remaining`,
          },
          {
            label: "Approval rate",
            value: `${percent(metrics.approved, metrics.approved + metrics.rejected)}%`,
            hint: `Need ${percent(PROMOTION.minApprovalRate * 100, 100)}% to promote`,
          },
          {
            label: "Jobs with interviews",
            value: `${percent(metrics.withInterview, metrics.approved)}%`,
            hint: `Need ${percent(PROMOTION.minInterviewProducingRate * 100, 100)}%`,
          },
          {
            label: "Approval credit",
            value: formatCents(approvalRewardCents(user.level, false)),
            hint: "Probation earns $0",
          },
        ]}
      />
      <SectionCard title="All levels">
        <Stack gap={4}>
          {(Object.keys(LEVELS) as ScoutLevel[]).map((id) => {
            const level = LEVELS[id];
            const current = id === user.level;
            return (
              <Stack key={id} gap={1}>
                <Text weight="semibold">
                  {level.label}
                  {current ? " · current" : ""}
                </Text>
                <Text type="supporting" color="secondary" display="block">
                  {level.dailyLimit}/day · interview {level.interviewMultiplier}× ·{" "}
                  {level.autoApprove
                    ? "auto-approve if checks pass"
                    : "moderator reviews every job"}
                </Text>
              </Stack>
            );
          })}
        </Stack>
      </SectionCard>
      {upcoming ? (
        <SectionCard
          title={`Next: ${LEVELS[upcoming].label}`}
          description={
            ready
              ? "You currently meet the promotion bars. They recompute from your live quality metrics."
              : "Hit every bar below. Falling below them after Expert demotes you."
          }
        >
          <Stack gap={4}>
            <Stack gap={2}>
              <Text type="supporting">
                Approved submissions {metrics.approved}/{PROMOTION.minApproved}
              </Text>
              <ProgressBar
                label="Approved submissions"
                isLabelHidden
                value={barValue(metrics.approved, PROMOTION.minApproved)}
                variant={metrics.approved >= PROMOTION.minApproved ? "success" : "accent"}
              />
            </Stack>
            <Stack gap={2}>
              <Text type="supporting">
                Approval rate {percent(metrics.approved, metrics.approved + metrics.rejected)}%
              </Text>
              <ProgressBar
                label="Approval rate"
                isLabelHidden
                value={percent(metrics.approvalRate, PROMOTION.minApprovalRate)}
                variant={metrics.approvalRate >= PROMOTION.minApprovalRate ? "success" : "accent"}
              />
            </Stack>
            <Stack gap={2}>
              <Text type="supporting">
                Duplicate/expired {percent(metrics.duplicateExpiredRate * 100, 100)}% (max{" "}
                {percent(PROMOTION.maxDuplicateExpiredRate * 100, 100)}%)
              </Text>
              <ProgressBar
                label="Duplicate and expired rate"
                isLabelHidden
                value={percent(metrics.duplicateExpiredRate, PROMOTION.maxDuplicateExpiredRate)}
                variant={
                  metrics.duplicateExpiredRate <= PROMOTION.maxDuplicateExpiredRate
                    ? "success"
                    : "warning"
                }
              />
            </Stack>
            <Stack gap={2}>
              <Text type="supporting">
                Jobs producing interviews {percent(metrics.interviewProducingRate * 100, 100)}%
              </Text>
              <ProgressBar
                label="Interview producing rate"
                isLabelHidden
                value={percent(metrics.interviewProducingRate, PROMOTION.minInterviewProducingRate)}
                variant={
                  metrics.interviewProducingRate >= PROMOTION.minInterviewProducingRate
                    ? "success"
                    : "accent"
                }
              />
            </Stack>
          </Stack>
        </SectionCard>
      ) : (
        <SectionCard title="Expert">
          <Text color="secondary" display="block">
            You are at the top scout level. Spot checks still apply. Stay above the quality bars or
            you drop back to Trusted.
          </Text>
        </SectionCard>
      )}
    </Stack>
  );
}
