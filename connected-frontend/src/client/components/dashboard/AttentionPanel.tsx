import { Glyph, type GlyphName } from "@openseat/design-system";
import Link from "next/link";

import { useHunter } from "@/src/client/context/HunterContext";
import { useHunterMetrics } from "@/src/client/hooks/useHunterMetrics";
import { Panel } from "@/src/shared/kit/Panel";
import { money, plural } from "@/src/shared/lib/format";
import { HUNTER_ROUTES } from "@/src/shared/routes/hunter";

interface AttentionItem {
  id: string;
  icon: GlyphName;
  title: string;
  detail: string;
  href: string;
}

export function AttentionPanel() {
  const { invoices } = useHunter();
  const metrics = useHunterMetrics();
  const overdue = invoices.filter((invoice) => invoice.status === "overdue");

  const candidates: (AttentionItem | false)[] = [
    metrics.pendingInquiries.length > 0 && {
      id: "inquiries",
      icon: "users",
      title: `${plural(metrics.pendingInquiries.length, "bidder")} contacted you about your tasks`,
      detail: "Review each pitch, negotiate a rate, and accept to connect.",
      href: HUNTER_ROUTES.messages,
    },
    metrics.awaitingReview.length > 0 && {
      id: "review",
      icon: "check",
      title: `${plural(metrics.awaitingReview.length, "application")} waiting for your QA`,
      detail: "Approve them so bidders get paid, or return them with a note.",
      href: HUNTER_ROUTES.monitoring,
    },
    overdue.length > 0 && {
      id: "overdue",
      icon: "clock",
      title: `${plural(overdue.length, "invoice")} overdue · ${money(metrics.outstanding)} outstanding`,
      detail: "Pay to keep your bidders working without interruption.",
      href: HUNTER_ROUTES.billing,
    },
    metrics.taskRows.some((row) => row.task.status === "open" && row.connected.length === 0) && {
      id: "open-tasks",
      icon: "sparkle",
      title: "An open task has no connected bidder yet",
      detail: "Bidders watching the board will contact you. Reply quickly to win the best ones.",
      href: HUNTER_ROUTES.tasks,
    },
  ];
  const items = candidates.filter((item): item is AttentionItem => Boolean(item));

  return (
    <Panel title="Needs your attention" subtitle="Actions that keep bidders working" flush>
      {items.length ? (
        <ul className="hx-list">
          {items.map((item) => (
            <li key={item.id}>
              <Link className="hx-list-item" href={item.href}>
                <span className="hx-stat-icon" data-tone="warning">
                  <Glyph name={item.icon} />
                </span>
                <span className="hx-list-body">
                  <span className="hx-list-title">{item.title}</span>
                  <span className="hx-list-meta">{item.detail}</span>
                </span>
                <Glyph name="chevronRight" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hx-panel-body hx-muted">You are all caught up.</p>
      )}
    </Panel>
  );
}
