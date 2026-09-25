import { Card, EmptyState, PageBody } from "@/src/shared/marketplace-ui";

export default function CandidateBidsPage() {
  return (
    <PageBody>
      <Card title="My bids" meta="Track proposals, conversations, and awarded work.">
        <EmptyState title="Your bid pipeline is ready" description="Submitted, in discussion, approved, and active bids will appear here." />
      </Card>
    </PageBody>
  );
}
