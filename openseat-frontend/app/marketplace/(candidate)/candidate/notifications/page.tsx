import { Badge, Card, PageBody } from "@/src/shared/marketplace-ui";
import { WorkflowSteps } from "@/src/shared/components/WorkflowSteps";

export default function CandidateNotificationsPage() {
  return <PageBody><div className="marketplace-page-header"><div><span className="eyebrow">Updates</span><h1>Notifications</h1><p className="body-md text-ink-muted">A single place for proposal decisions, invitations, schedule changes, and payment events.</p></div><Badge label="Inbox skeleton" tone="info" /></div><WorkflowSteps title="Notification flow" steps={[{label:"Event occurs",description:"A client reviews, invites, schedules, or funds work.",state:"current"},{label:"You are notified",description:"The update is grouped by room and importance.",state:"upcoming"},{label:"Open the room",description:"Take the next action with the full context beside it.",state:"upcoming"}]} /><Card title="Recent updates" meta="Notifications will become actionable as services connect"><p className="body-md">You are all caught up.</p></Card></PageBody>;
}
