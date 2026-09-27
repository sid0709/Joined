import type { Metadata } from "next";
import { Card, GridColumn, GridSystem, MetadataList, MetadataListItem, Stack, Text } from "@openseat/design-system";
import { PageHeader } from "@/components/page-header";
import { BILLING, formatCents } from "@/lib/account";
import { COMPANY_BILLING_PAGE } from "@/lib/routes";

export const metadata: Metadata = { title: COMPANY_BILLING_PAGE.label };

export default function BillingPage() {
  const stats = [
    { label: "Plan", value: BILLING.plan },
    { label: "Spend this month", value: formatCents(BILLING.spendCents, BILLING.currency) },
    { label: "Monthly cap", value: formatCents(BILLING.capCents, BILLING.currency) },
    { label: "Free interviews left", value: String(BILLING.freeInterviewsRemaining) },
  ];

  return (
    <Stack gap={5}>
      <PageHeader title={COMPANY_BILLING_PAGE.label} description={COMPANY_BILLING_PAGE.description} />
      <GridSystem gap={3}>
        {stats.map((stat) => (
          <GridColumn key={stat.label} span={12} sm={6} lg={3}>
            <Card variant="muted">
              <Stack gap={1}>
                <Text type="supporting" color="secondary">
                  {stat.label}
                </Text>
                <Text type="display-3">{stat.value}</Text>
              </Stack>
            </Card>
          </GridColumn>
        ))}
      </GridSystem>
      <Card>
        <MetadataList columns="single" label={{ position: "start", width: 180 }}>
          <MetadataListItem label="Billable event">An interview scheduled here that the candidate attended.</MetadataListItem>
          <MetadataListItem label="Not billable">No-show, cancel more than 24 hours ahead, or a failed face check.</MetadataListItem>
          <MetadataListItem label="Payment method">Not added</MetadataListItem>
        </MetadataList>
      </Card>
    </Stack>
  );
}
