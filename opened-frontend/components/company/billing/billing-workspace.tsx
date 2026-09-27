"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Glyph,
  GridColumn,
  GridSystem,
  HStack,
  Heading,
  NumberInput,
  Stack,
  Table,
  Text,
  useToast,
  type TableColumn,
} from "@openseat/design-system";
import { SettingsGroup, SettingsRow } from "@/components/settings-group";
import { SectionCard } from "@/components/section-card";
import {
  BILLABLE_EVENTS,
  BILLING,
  BILLING_STATUS_META,
  jobTitle,
  type BillableEvent,
} from "@/lib/company";
import { formatShortDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { SpendSummary } from "../spend-summary";

const CENTS_PER_DOLLAR = 100;
const CAP_STEP_DOLLARS = 100;
const DATE_COLUMN_WIDTH = 72;
const RULES = [
  "Posting jobs and reviewing applicants is always free.",
  "You pay only when a candidate attends an interview scheduled here.",
  "No-shows, failed face checks, and cancellations 24h+ ahead are never billed.",
  "Billing stops at your monthly cap. Interviews still run.",
];

const COLUMNS: TableColumn<BillableEvent>[] = [
  {
    key: "date",
    header: "Date",
    width: DATE_COLUMN_WIDTH,
    render: (row) => <Text color="secondary">{formatShortDate(row.date)}</Text>,
  },
  {
    key: "candidate",
    header: "Interview",
    render: (row) => (
      <Stack gap={0}>
        <Text weight="medium">{row.candidate}</Text>
        <Text type="supporting" color="secondary">
          {jobTitle(row.jobId)} · {row.note}
        </Text>
      </Stack>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <Badge
        label={BILLING_STATUS_META[row.status].label}
        variant={BILLING_STATUS_META[row.status].badge}
      />
    ),
  },
  {
    key: "amountCents",
    header: "Amount",
    align: "end",
    render: (row) => (
      <Text weight="medium" hasTabularNumbers>
        {formatCents(row.amountCents, BILLING.currency)}
      </Text>
    ),
  },
];

/** Plan, usage, billable events, the monthly cap, and how to pay. */
export function BillingWorkspace() {
  const toast = useToast();
  const [capDollars, setCapDollars] = useState(BILLING.capCents / CENTS_PER_DOLLAR);

  return (
    <Stack gap={6}>
      <Card padding={6} elevation="low">
        <HStack hAlign="between" vAlign="center" gap={5} wrap="wrap">
          <Stack gap={1}>
            <HStack gap={2} vAlign="center">
              <Text type="supporting" color="secondary">
                Current plan
              </Text>
              <Badge label="Active" variant="success" />
            </HStack>
            <Heading level={2}>{BILLING.plan}</Heading>
            <Text color="secondary" display="block">
              {formatCents(BILLING.pricePerInterviewCents, BILLING.currency)} per attended interview
              · resets {formatShortDate(BILLING.renewsOn)}
            </Text>
          </Stack>
          <Stack gap={0} hAlign="end">
            <Heading level={2} type="display-3">
              {formatCents(BILLING.pricePerInterviewCents, BILLING.currency)}
            </Heading>
            <Text type="supporting" color="secondary">
              per interview
            </Text>
          </Stack>
        </HStack>
      </Card>

      <GridSystem gap={6} align="start">
        <GridColumn span="full" lg={7}>
          <Stack gap={6}>
            <SectionCard title="This month">
              <SpendSummary />
            </SectionCard>
            <SettingsGroup
              title="Billable events"
              description="Every interview this month and whether it counted."
            >
              <Table
                caption="Billable events"
                columns={COLUMNS}
                rows={BILLABLE_EVENTS}
                rowKey={(row) => row.id}
                variant="plain"
              />
            </SettingsGroup>
          </Stack>
        </GridColumn>
        <GridColumn span="full" lg={5}>
          <Stack gap={6}>
            <SectionCard title="Payment method">
              {BILLING.paymentMethod ? (
                <Text>
                  {BILLING.paymentMethod.brand} ending {BILLING.paymentMethod.last4}
                </Text>
              ) : (
                <EmptyState
                  isCompact
                  icon={<Glyph name="lock" />}
                  title="No card on file"
                  description={`Add one before your ${BILLING.freeInterviewsRemaining} free interviews run out.`}
                  actions={
                    <Button
                      label="Add payment method"
                      variant="primary"
                      size="sm"
                      onClick={() => toast({ body: "Secure checkout isn’t connected yet." })}
                    />
                  }
                />
              )}
            </SectionCard>

            <SettingsGroup
              title="Monthly cap"
              description="Billing stops here. Interviews keep running."
              footer={
                <HStack hAlign="end">
                  <Button
                    label="Save cap"
                    variant="primary"
                    size="sm"
                    onClick={() =>
                      toast({
                        body: `Cap set to ${formatCents(capDollars * CENTS_PER_DOLLAR, BILLING.currency)}`,
                      })
                    }
                  />
                </HStack>
              }
            >
              <SettingsRow label="Cap" description="In US dollars.">
                <NumberInput
                  label="Monthly cap"
                  isLabelHidden
                  value={capDollars}
                  onChange={setCapDollars}
                  min={0}
                  step={CAP_STEP_DOLLARS}
                  isIntegerOnly
                  units={BILLING.currency}
                />
              </SettingsRow>
            </SettingsGroup>

            <SectionCard title="How billing works">
              <Stack gap={3}>
                {RULES.map((rule) => (
                  <HStack key={rule} gap={2} vAlign="start">
                    <Text color="accent">
                      <Glyph name="check" />
                    </Text>
                    <Text type="supporting">{rule}</Text>
                  </HStack>
                ))}
              </Stack>
            </SectionCard>
          </Stack>
        </GridColumn>
      </GridSystem>
    </Stack>
  );
}
