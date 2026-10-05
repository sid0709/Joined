"use client";

import { useState } from "react";
import {
  Banner,
  BarChart,
  Glyph,
  GridColumn,
  GridSystem,
  HStack,
  MetadataList,
  MetadataListItem,
  PageHeader,
  SectionCard,
  SegmentedControl,
  SegmentedControlItem,
  Stack,
  Text,
} from "sid-ui";
import {
  BILLING_CYCLE_DAYS,
  SAMPLE_SUBSCRIPTION,
  currentCycle,
  formatPrice,
  planById,
  sampleInvoices,
  type BillingInterval,
} from "@/lib/billing";
import type { Activity } from "@/lib/workspace/activity";
import { addDays, formatDay } from "@/lib/workspace/dates";
import { useWorkspace } from "@/components/workspace/use-workspace";
import { InvoiceTable } from "./invoice-table";
import { PlanCards } from "./plan-cards";
import { UsageMeters } from "./usage-meters";

const CYCLES_SHOWN = 6;
const SAMPLE_MAILBOXES = 2;

export function BillingPanel({ activity }: { activity: Activity }) {
  const { workspace } = useWorkspace();
  const [interval, setBillingInterval] = useState<BillingInterval>(SAMPLE_SUBSCRIPTION.interval);
  const { today, applications } = activity;
  const plan = planById(SAMPLE_SUBSCRIPTION.planId);
  const cycle = currentCycle(today);
  const card = SAMPLE_SUBSCRIPTION.card;

  const sentBetween = (from: string, to: string) =>
    applications.filter((app) => app.appliedOn && app.appliedOn >= from && app.appliedOn < to)
      .length;

  const cycles = Array.from({ length: CYCLES_SHOWN }, (_, index) => {
    const start = addDays(cycle.start, -(CYCLES_SHOWN - 1 - index) * BILLING_CYCLE_DAYS);
    return {
      label: formatDay(start),
      value: sentBetween(start, addDays(start, BILLING_CYCLE_DAYS)),
      tone: index === CYCLES_SHOWN - 1 ? ("blue" as const) : ("neutral" as const),
    };
  });

  return (
    <Stack gap={6}>
      <PageHeader
        title="Billing"
        description="Your plan, what this cycle has used, and every charge."
        action={
          <SegmentedControl
            label="Billing interval"
            value={interval}
            onChange={(value) => setBillingInterval(value as BillingInterval)}
          >
            <SegmentedControlItem value="monthly" label="Monthly" />
            <SegmentedControlItem value="yearly" label="Yearly" />
          </SegmentedControl>
        }
      />
      <Banner
        status="info"
        title="Sample billing"
        description="No payment provider is connected yet. The plan, card, and invoices below are placeholders, and plan switches turn on once checkout is wired."
      />
      <PlanCards current={plan.id} interval={interval} />
      <GridSystem gap={4} align="stretch">
        <GridColumn span="full" lg={7}>
          <SectionCard
            title="This cycle"
            description={`${formatDay(cycle.start)} – ${formatDay(cycle.renews)} · renews in ${BILLING_CYCLE_DAYS - SAMPLE_SUBSCRIPTION.dayOfCycle} days`}
          >
            <UsageMeters
              limits={plan.limits}
              used={{
                applications: sentBetween(cycle.start, addDays(today, 1)),
                drafts: workspace.resumes.length,
                mailboxes: workspace.mailboxes.length || SAMPLE_MAILBOXES,
              }}
            />
          </SectionCard>
        </GridColumn>
        <GridColumn span="full" lg={5}>
          <SectionCard title="Payment method" description="Charged on each renewal.">
            <Stack gap={4}>
              <HStack gap={3} vAlign="center">
                <Glyph name="creditCard" />
                <Stack gap={0}>
                  <Text weight="semibold">{`${card.brand} ending in ${card.last4}`}</Text>
                  <Text type="supporting" color="secondary">
                    {`Expires ${card.expires}`}
                  </Text>
                </Stack>
              </HStack>
              <MetadataList columns={2}>
                <MetadataListItem label="Plan">{`${plan.name} · ${SAMPLE_SUBSCRIPTION.interval}`}</MetadataListItem>
                <MetadataListItem label="Next charge">
                  {`${formatPrice(plan.price[SAMPLE_SUBSCRIPTION.interval])} on ${formatDay(cycle.renews)}`}
                </MetadataListItem>
              </MetadataList>
            </Stack>
          </SectionCard>
        </GridColumn>
        <GridColumn span="full" lg={5}>
          <SectionCard
            title="Applications per cycle"
            description="The current cycle is highlighted."
          >
            <BarChart label="Applications per billing cycle" data={cycles} height={180} />
          </SectionCard>
        </GridColumn>
        <GridColumn span="full" lg={7}>
          <SectionCard title="Invoices" description="The next charge, then past ones.">
            <InvoiceTable invoices={sampleInvoices(today)} />
          </SectionCard>
        </GridColumn>
      </GridSystem>
    </Stack>
  );
}
