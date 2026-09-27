import type { Metadata } from "next";
import { Card, Heading, Stack, Timeline, type TimelineItem } from "@openseat/design-system";
import { PageHeader } from "@/components/page-header";
import { INTERVIEWS } from "@/lib/account";
import { INTERVIEWS_PAGE } from "@/lib/routes";

export const metadata: Metadata = { title: INTERVIEWS_PAGE.label };

const ITEMS: TimelineItem[] = INTERVIEWS.map((item) => ({
  id: item.id,
  title: item.title,
  time: item.time,
  description: item.description,
  group: item.group,
  status: item.status,
}));

export default function InterviewsPage() {
  return (
    <Stack gap={5} maxWidth={720}>
      <PageHeader title={INTERVIEWS_PAGE.label} description={INTERVIEWS_PAGE.description} />
      <Card>
        <Stack gap={3}>
          <Heading level={2}>Schedule</Heading>
          <Timeline label="Interviews" items={ITEMS} />
        </Stack>
      </Card>
    </Stack>
  );
}
