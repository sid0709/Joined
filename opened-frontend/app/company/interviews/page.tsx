import type { Metadata } from "next";
import { Badge, Card, Heading, Stack, Timeline, type TimelineItem } from "@openseat/design-system";
import { PageHeader } from "@/components/page-header";
import { COMPANY_INTERVIEWS_PAGE } from "@/lib/routes";

export const metadata: Metadata = { title: "Company interviews" };

const ITEMS: TimelineItem[] = [
  {
    id: "c1",
    title: "Alex Rivera · Product Designer",
    time: "Tue · 10:00",
    description: "Round 1 · Video room · Face check when they join.",
    group: "Upcoming",
    status: "current",
    meta: <Badge label="Scheduled" variant="info" />,
  },
  {
    id: "c2",
    title: "Dana Kim · Product Designer",
    time: "Wed · 15:00",
    description: "Round 1 · Waiting on a slot. Assisted application.",
    group: "Upcoming",
    status: "upcoming",
  },
  {
    id: "c3",
    title: "Riley Chen · Data Analyst",
    time: "Sep 20",
    description: "Round 1 · Attended. This interview is billable.",
    group: "Past",
    status: "done",
    meta: <Badge label="Attended" variant="success" />,
  },
];

export default function CompanyInterviewsPage() {
  return (
    <Stack gap={5} maxWidth={760}>
      <PageHeader title={COMPANY_INTERVIEWS_PAGE.label} description={COMPANY_INTERVIEWS_PAGE.description} />
      <Card>
        <Stack gap={3}>
          <Heading level={2}>Calendar</Heading>
          <Timeline label="Company interviews" items={ITEMS} />
        </Stack>
      </Card>
    </Stack>
  );
}
