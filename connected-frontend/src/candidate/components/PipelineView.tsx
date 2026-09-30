"use client";

import Link from "next/link";

import type { Engagement } from "@/src/candidate/types/workspace";

import { HunterLine } from "@/src/candidate/components/ui/HunterLine";
import { PIPELINE_LINKS, SectionNav } from "@/src/candidate/components/ui/SectionNav";
import { useBidderWorkspace } from "@/src/candidate/context/BidderWorkspaceContext";
import { BOARD_TASK_BY_ID, HUNTER_BY_ID } from "@/src/candidate/data/board";
import { EmptyBlock } from "@/src/shared/kit/EmptyBlock";
import { PageHeader } from "@/src/shared/kit/PageHeader";
import { StatCard } from "@/src/shared/kit/StatCard";
import { money, plural, relativeTime, shortDate } from "@/src/shared/lib/format";
import { Button, PageBody } from "@/src/shared/marketplace-ui";
import { PACKAGE_BY_ID } from "@/src/shared/mock/packages";
import { BIDDER_ROUTES } from "@/src/shared/routes/bidder";

type Column = "waiting" | "negotiating" | "interview" | "connected" | "closed";

const COLUMNS: { id: Column; title: string; hint: string }[] = [
  { id: "waiting", title: "Waiting for reply", hint: "Message sent" },
  { id: "negotiating", title: "Negotiating", hint: "Agreeing rate and pace" },
  { id: "interview", title: "Interview", hint: "Call scheduled" },
  { id: "connected", title: "Connected", hint: "Receiving links" },
  { id: "closed", title: "Closed", hint: "Declined or withdrawn" },
];

const columnOf = (engagement: Engagement): Column => {
  if (engagement.status === "declined" || engagement.status === "withdrawn") return "closed";
  if (engagement.status === "connected") return "connected";
  if (engagement.status === "contacted") return "waiting";
  return engagement.stage === "interview" ? "interview" : "negotiating";
};

export function PipelineView() {
  const { engagements, invitations, interviews, assignments, withdrawEngagement } =
    useBidderWorkspace();
  const pendingInvites = invitations.filter((item) => item.status === "pending").length;
  const upcoming = interviews.filter((item) => item.status === "scheduled").length;

  return (
    <PageBody>
      <div className="hx-page">
        <PageHeader
          eyebrow="Pipeline"
          title="Every task you are pursuing"
          description="Follow each conversation from your first message to a connected desk. Move faster by answering hunters quickly and keeping your rates realistic."
          actions={<Button href={BIDDER_ROUTES.board} variant="primary" label="Find more tasks" />}
        />
        <SectionNav
          label="Pipeline sections"
          links={PIPELINE_LINKS.map((link) =>
            link.href === BIDDER_ROUTES.invitations ? { ...link, count: pendingInvites } : link,
          )}
        />

        <div className="hx-grid hx-grid-stats">
          <StatCard
            label="Active conversations"
            value={
              engagements.filter((item) => ["contacted", "negotiating"].includes(item.status))
                .length
            }
            icon="chat"
            footnote="Waiting on a decision"
          />
          <StatCard
            label="Connected desks"
            value={engagements.filter((item) => item.status === "connected").length}
            icon="link"
            tone="success"
            footnote={`${assignments.filter((item) => item.status === "active").length} active assignments`}
          />
          <StatCard
            label="Invitations"
            value={pendingInvites}
            icon="mail"
            tone="warning"
            footnote="Hunters who invited you"
          />
          <StatCard
            label="Upcoming interviews"
            value={upcoming}
            icon="calendar"
            footnote="On your calendar"
          />
        </div>

        {engagements.length === 0 ? (
          <EmptyBlock
            icon="search"
            title="Nothing in your pipeline yet"
            description="Contact a job hunter from the task board to get started."
            action={<Button href={BIDDER_ROUTES.board} variant="primary" label="Browse tasks" />}
          />
        ) : (
          <div className="bx-board">
            {COLUMNS.map((column) => {
              const cards = engagements.filter((item) => columnOf(item) === column.id);
              return (
                <section key={column.id} className="bx-lane" aria-label={column.title}>
                  <header className="bx-lane-head">
                    <div>
                      <strong>{column.title}</strong>
                      <span className="hx-small hx-muted bx-block">{column.hint}</span>
                    </div>
                    <span className="hx-chip">{cards.length}</span>
                  </header>
                  <div className="bx-lane-body">
                    {cards.length === 0 && (
                      <span className="hx-small hx-faint bx-lane-empty">Nothing here</span>
                    )}
                    {cards.map((engagement) => {
                      const task = BOARD_TASK_BY_ID.get(engagement.taskId);
                      const hunter = task && HUNTER_BY_ID.get(task.hunterId);
                      if (!task || !hunter) return null;
                      const last = engagement.messages.at(-1);
                      const interview = interviews.find(
                        (item) =>
                          item.engagementId === engagement.id && item.status === "scheduled",
                      );
                      return (
                        <article key={engagement.id} className="bx-ticket">
                          <HunterLine hunter={hunter} size={24} />
                          <Link
                            href={BIDDER_ROUTES.task(task.id)}
                            className="bx-title-link hx-strong"
                          >
                            {task.title}
                          </Link>
                          <div className="hx-chip-row">
                            {engagement.proposedRates.map((rate) => (
                              <span key={rate.packageId} className="hx-chip">
                                {PACKAGE_BY_ID.get(rate.packageId)?.ats[0]} · {money(rate.rate)}
                              </span>
                            ))}
                          </div>
                          {interview && (
                            <span className="hx-ticket-interview">
                              Interview {shortDate(`${interview.date}T00:00:00Z`)} ·{" "}
                              {interview.start}
                            </span>
                          )}
                          {last && (
                            <p className="hx-small hx-muted bx-snippet">
                              {last.sender === "bidder" ? "You: " : ""}
                              {last.body}
                            </p>
                          )}
                          <div className="hx-row hx-row-between">
                            <span className="hx-small hx-faint">
                              {plural(engagement.messages.length, "message")} ·{" "}
                              {last ? relativeTime(last.at) : ""}
                            </span>
                            {engagement.unread > 0 && (
                              <span className="hx-unread">{engagement.unread}</span>
                            )}
                          </div>
                          <div className="hx-row">
                            <Button
                              href={BIDDER_ROUTES.thread(engagement.id)}
                              variant="primary"
                              size="sm"
                              label="Open chat"
                            />
                            {column.id === "connected" && (
                              <Button
                                href={BIDDER_ROUTES.work}
                                variant="secondary"
                                size="sm"
                                label="My work"
                              />
                            )}
                            {(column.id === "waiting" || column.id === "negotiating") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                label="Withdraw"
                                onClick={() => withdrawEngagement(engagement.id)}
                              />
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </PageBody>
  );
}
