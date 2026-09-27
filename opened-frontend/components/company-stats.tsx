"use client";

import { Card, GridColumn, GridSystem, HStack, Icon, Stack, Text, icons } from "@openseat/design-system";
import { BILLING, COMPANY_JOBS, formatCents } from "@/lib/account";

const OPEN_JOBS = COMPANY_JOBS.filter((job) => job.status === "Open").length;
const APPLICANT_COUNT = COMPANY_JOBS.reduce((sum, job) => sum + job.applicants, 0);

const STATS = [
  { label: "Open jobs", value: String(OPEN_JOBS), icon: icons.folder },
  { label: "Applicants", value: String(APPLICANT_COUNT), icon: icons.users },
  { label: "Interviews this week", value: "3", icon: icons.calendar },
  { label: "Spend this month", value: formatCents(BILLING.spendCents, BILLING.currency), icon: icons.file },
];

export function CompanyStats() {
  return (
    <GridSystem gap={3}>
      {STATS.map((stat) => (
        <GridColumn key={stat.label} span={12} sm={6} lg={3}>
          <Card variant="muted">
            <Stack gap={2}>
              <HStack gap={2} vAlign="center">
                <Icon icon={stat.icon} color="secondary" size="sm" />
                <Text type="supporting" color="secondary">
                  {stat.label}
                </Text>
              </HStack>
              <Text type="display-3">{stat.value}</Text>
            </Stack>
          </Card>
        </GridColumn>
      ))}
    </GridSystem>
  );
}
