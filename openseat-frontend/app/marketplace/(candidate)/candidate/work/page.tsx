import { Card, EmptyState, PageBody } from "@/src/shared/marketplace-ui";

export default function CandidateWorkPage() {
  return (
    <PageBody>
      <Card title="Active work" meta="Awarded jobs become contracts with milestones and submissions.">
        <EmptyState title="No active work yet" description="Approved jobs will appear here when a client starts delivery." />
      </Card>
    </PageBody>
  );
}
