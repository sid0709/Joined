"use client";

import { Glyph, type GlyphName } from "@joined/design-system";
import Link from "next/link";

import { HunterLine } from "@/src/candidate/components/ui/HunterLine";
import { useBidderWorkspace } from "@/src/candidate/context/BidderWorkspaceContext";
import { BOARD_TASK_BY_ID, HUNTER_BY_ID } from "@/src/candidate/data/board";
import { bidderQa, earningsSummary } from "@/src/candidate/lib/derive";
import { DailyBars } from "@/src/shared/kit/charts/DailyBars";
import { EmptyBlock } from "@/src/shared/kit/EmptyBlock";
import { Legend } from "@/src/shared/kit/Meter";
import { PageHeader } from "@/src/shared/kit/PageHeader";
import { Panel } from "@/src/shared/kit/Panel";
import { StatCard } from "@/src/shared/kit/StatCard";
import { ApplicationStatusBadge } from "@/src/shared/kit/StatusBadge";
import { dayKey, longDate, money, percent, plural, relativeTime } from "@/src/shared/lib/format";
import { dailySeries } from "@/src/shared/lib/selectors";
import { Button, PageBody } from "@/src/shared/marketplace-ui";
import { MOCK_TODAY } from "@/src/shared/mock/clock";
import { POOL_BY_ID } from "@/src/shared/mock/pool";
import { BIDDER_ROUTES } from "@/src/shared/routes/bidder";

const FLOW: { label: string; hint: string; icon: GlyphName }[] = [
  { label: "Find a task", hint: "Compare pay per link", icon: "search" },
  { label: "Chat and agree", hint: "Rate, pace, interview", icon: "chat" },
  { label: "Get connected", hint: "Hunter assigns links", icon: "link" },
  { label: "Apply and submit", hint: "With evidence", icon: "send" },
  { label: "Pass QA", hint: "Fix anything returned", icon: "check" },
  { label: "Get paid", hint: "Weekly payouts", icon: "download" },
];

export function DashboardView() {
  const {
    profile,
    applications,
    assignments,
    engagements,
    invitations,
    interviews,
    reviews,
    payouts,
    transactions,
    assessments,
    unreadMessages,
    startApplication,
  } = useBidderWorkspace();

  const active = assignments.filter((item) => item.status === "active");
  const target = active.reduce((sum, item) => sum + item.dailyTarget, 0);
  const series = dailySeries(applications, 14, target);
  const today = series.at(-1)?.submitted ?? 0;
  const last7 = series.slice(-7).reduce((sum, point) => sum + point.submitted, 0);
  const prev7 = series.slice(0, 7).reduce((sum, point) => sum + point.submitted, 0);
  const change = prev7 ? ((last7 - prev7) / prev7) * 100 : 0;
  const money$ = earningsSummary(applications, assignments, payouts, transactions);
  const qa = bidderQa(applications);
  const queue = applications
    .filter((item) => ["returned", "in_progress", "queued"].includes(item.status))
    .sort((a, b) => {
      const order = { returned: 0, in_progress: 1, queued: 2 } as Record<string, number>;
      return order[a.status] - order[b.status];
    })
    .slice(0, 6);
  const returned = applications.filter((item) => item.status === "returned").length;
  const pendingInvites = invitations.filter((item) => item.status === "pending").length;
  const openReviews = reviews.filter(
    (review) =>
      (review.verdict === "mistake" || review.verdict === "warning") &&
      review.resolution === "open",
  ).length;
  const nextInterview = interviews
    .filter((item) => item.status === "scheduled")
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))[0];
  const nextEngagement =
    nextInterview && engagements.find((item) => item.id === nextInterview.engagementId);
  const nextTask = nextEngagement && BOARD_TASK_BY_ID.get(nextEngagement.taskId);
  const nextHunter = nextTask && HUNTER_BY_ID.get(nextTask.hunterId);
  const openAssessments = assessments.filter((item) => item.status !== "passed").length;

  const attention: { icon: GlyphName; text: string; href: string; cta: string; tone?: "danger" }[] =
    [];
  if (returned)
    attention.push({
      icon: "refresh",
      text: `${plural(returned, "application")} returned for a fix`,
      href: BIDDER_ROUTES.work,
      cta: "Fix now",
      tone: "danger",
    });
  if (openReviews)
    attention.push({
      icon: "info",
      text: `${plural(openReviews, "review")} waiting for your reply`,
      href: BIDDER_ROUTES.reviews,
      cta: "Reply",
    });
  if (unreadMessages)
    attention.push({
      icon: "chat",
      text: `${plural(unreadMessages, "unread message")}`,
      href: BIDDER_ROUTES.messages,
      cta: "Open chat",
    });
  if (pendingInvites)
    attention.push({
      icon: "mail",
      text: `${plural(pendingInvites, "invitation")} from job hunters`,
      href: BIDDER_ROUTES.invitations,
      cta: "Review",
    });
  if (openAssessments)
    attention.push({
      icon: "sparkle",
      text: `${plural(openAssessments, "assessment")} unlocks higher-paying tasks`,
      href: BIDDER_ROUTES.assessments,
      cta: "Take it",
    });

  return (
    <PageBody>
      <div className="hx-page">
        <PageHeader
          eyebrow="Bidder workspace"
          title={`Good morning, ${profile.name.split(" ")[0]}`}
          description="Find tasks, talk to job hunters, apply to the links they assign you and get paid for every approved application."
          actions={
            <>
              <Button href={BIDDER_ROUTES.board} variant="secondary" label="Browse tasks" />
              <Button href={BIDDER_ROUTES.work} variant="primary" label="Open my work" />
            </>
          }
        />

        <div className="hx-grid hx-grid-stats">
          <StatCard
            label="Links submitted · 7 days"
            value={last7}
            icon="send"
            trend={series.slice(-7).map((point) => point.submitted)}
            delta={{
              text: `${change >= 0 ? "+" : ""}${change.toFixed(0)}% vs previous week`,
              tone: change >= 0 ? "success" : "danger",
            }}
          />
          <StatCard
            label="QA pass rate"
            value={percent(qa, 1)}
            icon="check"
            tone="success"
            footnote={`${profile.level} level · ${applications.filter((item) => item.status === "qa_passed").length} passed`}
          />
          <StatCard
            label="Today's progress"
            value={`${today} / ${target}`}
            icon="clock"
            tone={today >= target ? "success" : "warning"}
            footnote="Submitted against your daily targets"
          />
          <StatCard
            label="Coming to you"
            value={money(money$.processing + money$.scheduled + money$.awaiting)}
            icon="download"
            tone="accent"
            footnote={`${money(money$.availableEarly)} can be paid out early`}
          />
        </div>

        <div className="hx-split">
          <div className="hx-stack">
            <Panel
              title="Daily throughput"
              subtitle="Applications you delivered across all desks, last 14 days"
            >
              <DailyBars points={series} />
              <Legend
                segments={[
                  {
                    label: "QA passed",
                    value: series.reduce((sum, point) => sum + point.qaPassed, 0),
                    tone: "positive",
                  },
                  {
                    label: "Awaiting QA or returned",
                    value: series.reduce((sum, point) => sum + point.submitted - point.qaPassed, 0),
                    tone: "soft",
                  },
                ]}
              />
            </Panel>

            <Panel
              title="Your queue"
              subtitle="Fix returned links first, then keep the day's pace"
              actions={
                <Button href={BIDDER_ROUTES.work} variant="ghost" size="sm" label="See all" />
              }
              flush
            >
              {queue.length === 0 ? (
                <EmptyBlock
                  icon="check"
                  title="Queue is clear"
                  description="Ask a connected hunter for another batch of links."
                />
              ) : (
                <ul className="hx-list">
                  {queue.map((application) => {
                    const job = POOL_BY_ID.get(application.jobId);
                    return (
                      <li key={application.id} className="hx-list-item">
                        <span className="hx-list-body">
                          <span className="hx-list-title">
                            {job?.company} · {job?.title}
                          </span>
                          <span className="hx-list-meta">
                            {job?.ats} · {job?.location} · {relativeTime(application.updatedAt)}
                          </span>
                        </span>
                        <ApplicationStatusBadge status={application.status} />
                        {application.status === "queued" ? (
                          <Button
                            variant="primary"
                            size="sm"
                            label="Start"
                            onClick={() => startApplication(application.id)}
                          />
                        ) : (
                          <Button
                            href={BIDDER_ROUTES.workDesk(application.assignmentId)}
                            variant={application.status === "returned" ? "primary" : "secondary"}
                            size="sm"
                            label={application.status === "returned" ? "Fix" : "Continue"}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>

          <div className="hx-stack">
            <Panel title="Needs your attention">
              {attention.length === 0 ? (
                <p className="hx-muted" style={{ margin: 0 }}>
                  You are all caught up. Nice work.
                </p>
              ) : (
                <div className="hx-stack hx-stack-sm">
                  {attention.map((item) => (
                    <Link
                      key={item.text}
                      href={item.href}
                      className="bx-attention"
                      data-tone={item.tone}
                    >
                      <span className="bx-attention-icon">
                        <Glyph name={item.icon} size="1.05em" />
                      </span>
                      <span className="hx-grow">{item.text}</span>
                      <span className="hx-small hx-link">{item.cta}</span>
                    </Link>
                  ))}
                </div>
              )}
            </Panel>

            <Panel
              title="Next interview"
              actions={
                <Button
                  href={BIDDER_ROUTES.interviews}
                  variant="ghost"
                  size="sm"
                  label="Calendar"
                />
              }
            >
              {nextInterview && nextHunter ? (
                <div className="hx-stack hx-stack-sm">
                  <HunterLine hunter={nextHunter} />
                  <strong>{nextTask?.title}</strong>
                  <span className="hx-ticket-interview">
                    <Glyph name="calendar" size="1em" />
                    {longDate(`${nextInterview.date}T00:00:00Z`)} · {nextInterview.start}
                    {nextInterview.date === MOCK_TODAY ? " · today" : ""}
                  </span>
                </div>
              ) : (
                <p className="hx-muted" style={{ margin: 0 }}>
                  Nothing scheduled.
                </p>
              )}
            </Panel>

            <Panel title="Active desks" subtitle="Where your links come from" flush>
              <ul className="hx-list">
                {active.map((assignment) => {
                  const task = BOARD_TASK_BY_ID.get(assignment.taskId);
                  const hunter = task && HUNTER_BY_ID.get(task.hunterId);
                  const todo = applications.filter(
                    (item) =>
                      item.assignmentId === assignment.id &&
                      ["queued", "in_progress", "returned"].includes(item.status),
                  ).length;
                  return (
                    <li key={assignment.id}>
                      <Link className="hx-list-item" href={BIDDER_ROUTES.workDesk(assignment.id)}>
                        <span className="hx-list-body">
                          <span className="hx-list-title">{hunter?.company}</span>
                          <span className="hx-list-meta">
                            {money(assignment.rate)}/link · {todo} to do
                          </span>
                        </span>
                        <Glyph name="chevronRight" size="1em" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          </div>
        </div>

        <Panel title="How work becomes pay" subtitle="The same path every desk follows">
          <ol className="bx-flow">
            {FLOW.map((step, index) => (
              <li key={step.label} className="bx-flow-step">
                <span className="bx-flow-icon">
                  <Glyph name={step.icon} size="1.1em" />
                </span>
                <strong>
                  {index + 1}. {step.label}
                </strong>
                <span className="hx-small hx-muted">{step.hint}</span>
              </li>
            ))}
          </ol>
          <span className="hx-small hx-faint">
            Today is {dayKey(new Date(`${MOCK_TODAY}T00:00:00Z`))}. Payouts run every Friday for the
            week before.
          </span>
        </Panel>
      </div>
    </PageBody>
  );
}
