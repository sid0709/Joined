import { Badge, Card, PageBody } from "@/src/shared/marketplace-ui";
import { WorkflowSteps } from "@/src/shared/components/WorkflowSteps";

export default function ClientNotificationsPage() {
  return <PageBody><div className="marketplace-page-header"><div><span className="eyebrow">Updates</span><h1>Notifications</h1><p className="body-md text-ink-muted">Stay aware of new bids, candidate replies, scheduled evaluations, deliveries, and payment events.</p></div><Badge label="Inbox skeleton" tone="info" /></div><WorkflowSteps title="Notification flow" steps={[{label:"A room changes",description:"A bidder applies, replies, schedules, or submits delivery.",state:"current"},{label:"Review the update",description:"See the change with its brief, proposal, and history.",state:"upcoming"},{label:"Continue the workflow",description:"Compare, message, approve, fund, or resolve from the room.",state:"upcoming"}]} /><Card title="Recent updates" meta="Room-linked notifications will appear here"><p className="body-md">You are all caught up.</p></Card></PageBody>;
}
