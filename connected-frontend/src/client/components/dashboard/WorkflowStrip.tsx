import { Glyph, type GlyphName } from "@openseat/design-system";
import Link from "next/link";

import { Panel } from "@/src/client/components/ui/Panel";
import { HUNTER_ROUTES } from "@/src/shared/routes/hunter";

const STEPS: { icon: GlyphName; title: string; body: string; href: string }[] = [
  {
    icon: "edit",
    title: "1 · Post a task",
    body: "Describe the work, choose packages and rates, and publish to the task board.",
    href: HUNTER_ROUTES.newTask,
  },
  {
    icon: "users",
    title: "2 · Bidders contact you",
    body: "Bidders browse the board and start a chat with the task owner. Accept to connect.",
    href: HUNTER_ROUTES.messages,
  },
  {
    icon: "link",
    title: "3 · Assign links",
    body: "Pick links from the admin-managed pool and hand them to a connected bidder.",
    href: HUNTER_ROUTES.pool,
  },
  {
    icon: "eye",
    title: "4 · Monitor and review",
    body: "Track daily output, QA results, and give bidders feedback on their work.",
    href: HUNTER_ROUTES.monitoring,
  },
  {
    icon: "download",
    title: "5 · Pay per link",
    body: "Pay weekly invoices for QA-passed links at each package's agreed rate.",
    href: HUNTER_ROUTES.billing,
  },
];

export function WorkflowStrip() {
  return (
    <Panel
      title="How your workspace runs"
      subtitle="The same five steps for permanent contracts and one-time batches"
    >
      <div
        className="hx-grid hx-grid-3"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(13rem, 1fr))" }}
      >
        {STEPS.map((step) => (
          <Link
            key={step.title}
            href={step.href}
            className="hx-task"
            style={{ gap: "var(--space-2)" }}
          >
            <span className="hx-stat-icon">
              <Glyph name={step.icon} />
            </span>
            <strong className="hx-strong">{step.title}</strong>
            <span className="hx-small hx-muted">{step.body}</span>
          </Link>
        ))}
      </div>
    </Panel>
  );
}
