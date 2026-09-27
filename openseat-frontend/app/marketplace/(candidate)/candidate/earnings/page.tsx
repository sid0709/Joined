import { WorkflowSteps } from "@/src/shared/components/WorkflowSteps";
import { Badge, Card, PageBody } from "@/src/shared/marketplace-ui";

export default function CandidateEarningsPage() {
  return (
    <PageBody>
      <div className="marketplace-page-header marketplace-page-intro">
        <div>
          <span className="eyebrow">Fair pay</span>
          <h1>Earnings</h1>
          <p className="body-md text-ink-muted">
            Track funded milestones, released payments, and how verified performance can improve
            your rate tier.
          </p>
        </div>
        <Badge label="Payment skeleton" tone="info" />
      </div>
      <WorkflowSteps
        title="Payment lifecycle"
        steps={[
          {
            label: "Complete funded milestone",
            description: "Work begins only after the agreed milestone is funded.",
            state: "current",
          },
          {
            label: "Submit delivery",
            description: "Attach the result and delivery notes to the room.",
            state: "upcoming",
          },
          {
            label: "Client review",
            description: "The job hunter accepts, requests changes, or opens a dispute.",
            state: "upcoming",
          },
          {
            label: "Payment released",
            description: "The ledger records a fair, auditable payout.",
            state: "locked",
          },
        ]}
      />
      <div className="marketplace-skeleton-grid">
        <Card title="Available balance" meta="Pending and released funds will be separated">
          <h2>$0.00</h2>
          <p className="body-sm text-ink-muted">No completed milestones yet.</p>
        </Card>
        <Card title="Rate progression" meta="Performance creates a visible path to higher rates">
          <p className="body-md">Current tier: Verified starter</p>
          <p className="body-sm text-ink-muted">
            Complete another evaluation to unlock the next review.
          </p>
        </Card>
      </div>
    </PageBody>
  );
}
