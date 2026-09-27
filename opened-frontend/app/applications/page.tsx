import type { Metadata } from "next";
import { Card, HStack, Stack, Text } from "@openseat/design-system";
import { ApplicationsTable } from "@/components/applications-table";
import { PageHeader } from "@/components/page-header";
import { APPLICATIONS, type ApplicationStatus } from "@/lib/account";
import { APPLICATIONS_PAGE } from "@/lib/routes";

export const metadata: Metadata = { title: APPLICATIONS_PAGE.label };

const INTERVIEW_STATUSES: ApplicationStatus[] = ["Interview", "Offer"];

export default function ApplicationsPage() {
  const interviews = APPLICATIONS.filter((row) => INTERVIEW_STATUSES.includes(row.status)).length;
  const rate = APPLICATIONS.length === 0 ? 0 : Math.round((interviews / APPLICATIONS.length) * 100);
  const stats = [
    { label: "Applications", value: String(APPLICATIONS.length) },
    { label: "Interviews", value: String(interviews) },
    { label: "Interview rate", value: `${rate}%` },
  ];

  return (
    <Stack gap={5}>
      <PageHeader title={APPLICATIONS_PAGE.label} description={APPLICATIONS_PAGE.description} />
      <HStack gap={3} wrap="wrap">
        {stats.map((stat) => (
          <Card key={stat.label} variant="muted" width={180}>
            <Stack gap={1}>
              <Text type="supporting" color="secondary">
                {stat.label}
              </Text>
              <Text type="display-3">{stat.value}</Text>
            </Stack>
          </Card>
        ))}
      </HStack>
      <ApplicationsTable />
    </Stack>
  );
}
