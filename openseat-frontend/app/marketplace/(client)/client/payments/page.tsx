import { WorkflowSteps } from "@/src/shared/components/WorkflowSteps";
import { Badge, Card, PageBody } from "@/src/shared/marketplace-ui";

export default function ClientPaymentsPage() {
  return (
    <PageBody>
      <div className="marketplace-page-header marketplace-page-intro">
        <div>
          <span className="eyebrow">Trust and transactions</span>
          <h1>Payments</h1>
          <p className="body-md text-ink-muted">
            Fund milestones before work starts, review deliveries, release fair payment, and keep
            every transaction attached to the job room.
          </p>
        </div>
        <Badge label="Payment skeleton" tone="info" />
      </div>
      <WorkflowSteps
        title="Client payment lifecycle"
        steps={[
          {
            label: "Verify payment method",
            description: "Confirm your account can fund a contract.",
            state: "current",
          },
          {
            label: "Fund milestone",
            description: "Place agreed funds in the room before delivery begins.",
            state: "upcoming",
          },
          {
            label: "Review delivery",
            description: "Accept work or request changes against the milestone brief.",
            state: "upcoming",
          },
          {
            label: "Release payment",
            description: "The ledger records the payout and the review becomes part of trust.",
            state: "locked",
          },
        ]}
      />
      <div className="marketplace-skeleton-grid">
        <Card title="Pending funding" meta="Milestones waiting for client action">
          <h2>$0.00</h2>
          <p className="body-sm text-ink-muted">No active contracts need funding.</p>
        </Card>
        <Card title="Transaction history" meta="A durable record of payments and disputes">
          <p className="body-md">No transactions yet.</p>
        </Card>
      </div>
    </PageBody>
  );
}
