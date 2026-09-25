import { Card, EmptyState, PageBody } from "@/src/shared/marketplace-ui";

export default function ClientWorkPage() {
  return (
    <PageBody>
      <Card title="Managed work" meta="Review active hires, milestones, and delivery status.">
        <EmptyState title="Managed work is coming next" description="Approved hires and milestone tracking will appear here." />
      </Card>
    </PageBody>
  );
}
