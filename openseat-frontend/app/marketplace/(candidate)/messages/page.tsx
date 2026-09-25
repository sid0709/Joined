import { Card, EmptyState, PageBody } from "@/src/shared/marketplace-ui";

export default function MessagesPage() {
  return (
    <PageBody>
      <Card title="Messages" meta="Conversations are organized by job and participant.">
        <EmptyState title="No conversations yet" description="Messages will appear here when a client responds to a bid." />
      </Card>
    </PageBody>
  );
}
