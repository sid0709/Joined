import { WorkflowSteps } from "@/src/shared/components/WorkflowSteps";
import { Badge, Card, PageBody, Button } from "@/src/shared/marketplace-ui";

export default function CandidateTestsPage() {
  return (
    <PageBody>
      <div className="marketplace-page-header marketplace-page-intro">
        <div>
          <span className="eyebrow">Assessments</span>
          <h1>Performance tests</h1>
          <p className="body-md text-ink-muted">
            Prepare for practical tests and interviews that make your profile more useful than a
            resume alone.
          </p>
        </div>
        <Badge label="Test platform placeholder" tone="info" />
      </div>
      <WorkflowSteps
        title="Assessment lifecycle"
        steps={[
          {
            label: "Choose an assessment",
            description: "Match the test to the work you want to win.",
            state: "current",
          },
          {
            label: "Prepare",
            description: "Review the brief, rubric, and expected deliverables.",
            state: "upcoming",
          },
          {
            label: "Complete test",
            description: "Submit work inside the scheduled session.",
            state: "upcoming",
          },
          {
            label: "Publish result",
            description: "Verified performance becomes a profile trust signal.",
            state: "locked",
          },
        ]}
      />
      <div className="marketplace-skeleton-grid">
        <Card title="Available assessments" meta="A future test catalog will be connected here">
          <p className="body-md">No assessments assigned yet.</p>
          <Button type="button" variant="secondary" disabled>
            View test catalog
          </Button>
        </Card>
        <Card title="Recent results" meta="Results remain attached to the relevant job room">
          <p className="body-md">Your verified results will appear here.</p>
        </Card>
      </div>
    </PageBody>
  );
}
