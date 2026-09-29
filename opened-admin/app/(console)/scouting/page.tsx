import type { Metadata } from "next";
import {
  Button,
  GridColumn,
  GridSystem,
  PageHeader,
  SectionCard,
  Stack,
  StatGrid,
} from "@openseat/design-system";
import {
  formatMoney,
  type AdminList,
  type AdminSubmission,
  type Overview,
  type Payout,
  type ScoutSummary,
} from "@openseat/scout";
import { PayoutList } from "@/components/scouting/payout-list";
import { QueueTable } from "@/components/scouting/queue-table";
import { VerificationList } from "@/components/scouting/verification-list";
import { ageLabel, formatCount } from "@/lib/format";
import { ROUTES } from "@/lib/nav";
import { OVERVIEW_QUEUE_ROWS } from "@/lib/scouting";
import { adminGet } from "@/lib/server/api";

export const metadata: Metadata = { title: "Scouting" };

export default async function ScoutingOverviewPage() {
  const [overview, queue, verifications, payouts] = await Promise.all([
    adminGet<Overview>("/v1/admin/scout/overview"),
    adminGet<AdminList<AdminSubmission>>(
      `/v1/admin/scout/submissions?status=needs_review&page_size=${OVERVIEW_QUEUE_ROWS}`,
    ),
    adminGet<AdminList<ScoutSummary>>("/v1/admin/scout/scouts?verification=pending&page_size=5"),
    adminGet<AdminList<Payout>>("/v1/admin/scout/payouts?status=requested&page_size=5"),
  ]);

  return (
    <Stack gap={6}>
      <PageHeader
        title="Scouting"
        description="Jobs scouts found on company sites, waiting for a decision before they reach job hunters."
        action={<Button label="Open review queue" variant="primary" href={ROUTES.queue} />}
      />
      <StatGrid
        stats={[
          {
            label: "Needs review",
            value: formatCount(overview.needs_review),
            hint: overview.oldest_review_at
              ? `Oldest waiting ${ageLabel(overview.oldest_review_at)}`
              : "Queue is clear",
          },
          {
            label: "Decided today",
            value: formatCount(overview.approved_today + overview.rejected_today),
            hint: `${formatCount(overview.approved_today)} approved · ${formatCount(overview.rejected_today)} rejected`,
          },
          {
            label: "Submitted today",
            value: formatCount(overview.submitted_today),
            hint: `${formatCount(overview.api_submitted_today)} over the API · ${formatCount(overview.checking)} checking now`,
          },
          {
            label: "Live scouted jobs",
            value: formatCount(overview.live_jobs),
            hint: `${formatCount(overview.scouts)} scouts`,
          },
        ]}
      />
      <SectionCard
        title="Oldest in the queue"
        description="Work the queue oldest first; probation scouts and flagged checks land here."
        action={<Button label="All" variant="ghost" size="sm" href={ROUTES.queue} />}
      >
        <QueueTable rows={queue.data} caption="Oldest submissions needing review" variant="plain" />
      </SectionCard>
      <GridSystem gap={6} align="start">
        <GridColumn span="full" lg={6}>
          <SectionCard
            title="Identity checks"
            description={`${formatCount(overview.pending_verifications)} scouts asked for tier 2, which unlocks payouts.`}
            action={
              <Button
                label="All scouts"
                variant="ghost"
                size="sm"
                href={`${ROUTES.scouts}?verification=pending`}
              />
            }
          >
            <VerificationList rows={verifications.data} />
          </SectionCard>
        </GridColumn>
        <GridColumn span="full" lg={6}>
          <SectionCard
            title="Payout requests"
            description={`${formatCount(overview.pending_payouts)} waiting · ${formatMoney(overview.pending_payout_amount)} in total.`}
            action={<Button label="All payouts" variant="ghost" size="sm" href={ROUTES.payouts} />}
          >
            <PayoutList rows={payouts.data} />
          </SectionCard>
        </GridColumn>
      </GridSystem>
    </Stack>
  );
}
