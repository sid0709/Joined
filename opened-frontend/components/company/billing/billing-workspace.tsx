"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
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
import { fetchBilling, fetchTeam, purchaseBalance } from "@/lib/company/api";
import { canPermission, currentMemberRole, denialReason, type TeamRole } from "@/lib/rbac";
import { BILLING_STATUS_META, type BillableEvent, type BillingAccount } from "@/lib/company";
import { formatShortDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { SpendSummary } from "../spend-summary";

const CENTS_PER_DOLLAR = 100;
const DATE_COLUMN_WIDTH = 72;
const RULES = [
  "Posting jobs and reviewing applicants is free.",
  "Adding balance here is credited in full. No card is charged.",
  "Scheduling an interview holds the price from that balance.",
  "A no-show returns the price. An attended round keeps it.",
];

function columns(currency: string): TableColumn<BillableEvent>[] {
  return [
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
          <Text weight="medium">{row.candidate || "Purchase"}</Text>
          <Text type="supporting" color="secondary">
            {row.jobTitle} · {row.note}
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
          {formatCents(row.amountCents, currency)}
        </Text>
      ),
    },
  ];
}

/** Prepaid balance: add an amount, see what interviews have used. */
export function BillingWorkspace() {
  const toast = useToast();
  const [billing, setBilling] = useState<BillingAccount | null>(null);
  const [dollars, setDollars] = useState(100);
  const [pending, setPending] = useState(false);
  const [actorRole, setActorRole] = useState<TeamRole | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([fetchBilling(), fetchTeam()])
      .then(([next, team]) => {
        if (!active) return;
        setBilling(next);
        setActorRole(currentMemberRole(team.members));
      })
      .catch((error: Error) => toast({ body: error.message, type: "error" }));
    return () => {
      active = false;
    };
  }, [toast]);

  if (!billing) return null;

  const canViewBilling = canPermission(actorRole, "billing.view");
  const canPurchase = canPermission(actorRole, "billing.purchase");
  // TODO(einstein): enforce billing.* on /billing and /billing/purchase.

  if (!canViewBilling) {
    return (
      <Stack gap={4}>
        <Text type="supporting" color="secondary">
          {denialReason(actorRole, "billing.view")}
        </Text>
      </Stack>
    );
  }

  const add = () => {
    if (!canPurchase) {
      toast({ body: denialReason(actorRole, "billing.purchase"), type: "error" });
      return;
    }

    setPending(true);
    purchaseBalance(dollars)
      .then((next) => {
        setBilling(next);
        toast({
          body: `${formatCents(dollars * CENTS_PER_DOLLAR, next.currency)} added to your balance`,
        });
      })
      .catch((error: Error) => toast({ body: error.message, type: "error" }))
      .finally(() => setPending(false));
  };

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
            <Heading level={2}>{billing.plan}</Heading>
            <Text color="secondary" display="block">
              {formatCents(billing.pricePerInterviewCents, billing.currency)} held per scheduled
              interview
            </Text>
          </Stack>
          <Stack gap={0} hAlign="end">
            <Heading level={2} type="display-3">
              {formatCents(billing.balanceCents, billing.currency)}
            </Heading>
            <Text type="supporting" color="secondary">
              balance left
            </Text>
          </Stack>
        </HStack>
      </Card>

      <GridSystem gap={6} align="start">
        <GridColumn span="full" lg={7}>
          <Stack gap={6}>
            <SectionCard title="Balance">
              <SpendSummary billing={billing} />
            </SectionCard>
            <SettingsGroup
              title="Interview charges"
              description="Each scheduled interview, and any price that was returned."
            >
              <Table
                caption="Interview charges"
                columns={columns(billing.currency)}
                rows={billing.events}
                rowKey={(row) => row.id}
                variant="plain"
              />
            </SettingsGroup>
            <SettingsGroup
              title="Purchases"
              description="Amounts added to this company. Each one is credited in full."
            >
              <Table
                caption="Purchases"
                columns={[
                  {
                    key: "date",
                    header: "Date",
                    render: (row) => <Text color="secondary">{formatShortDate(row.date)}</Text>,
                  },
                  {
                    key: "amountCents",
                    header: "Amount",
                    align: "end",
                    render: (row) => (
                      <Text weight="medium" hasTabularNumbers>
                        {formatCents(row.amountCents, billing.currency)}
                      </Text>
                    ),
                  },
                ]}
                rows={billing.purchases}
                rowKey={(row) => row.id}
                variant="plain"
              />
            </SettingsGroup>
          </Stack>
        </GridColumn>
        <GridColumn span="full" lg={5}>
          <Stack gap={6}>
            <SettingsGroup
              title="Add balance"
              description={
                canPurchase
                  ? "Type an amount. It is added immediately. Nothing is sent to a card processor."
                  : denialReason(actorRole, "billing.purchase")
              }
              footer={
                <HStack hAlign="end">
                  <Button
                    label="Add balance"
                    variant="primary"
                    size="sm"
                    isDisabled={pending || dollars < 1 || !canPurchase}
                    onClick={add}
                  />
                </HStack>
              }
            >
              <SettingsRow label="Amount" description="In US dollars.">
                <NumberInput
                  label="Amount to add"
                  isLabelHidden
                  value={dollars}
                  onChange={setDollars}
                  min={1}
                  step={1}
                  isIntegerOnly
                  units={billing.currency}
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
