"use client";

import { Glyph } from "@openseat/design-system";

import { TaskContactPanel } from "@/src/candidate/components/TaskContactPanel";
import { HunterLine } from "@/src/candidate/components/ui/HunterLine";
import { useBidderWorkspace } from "@/src/candidate/context/BidderWorkspaceContext";
import { BOARD_TASK_BY_ID, HUNTER_BY_ID } from "@/src/candidate/data/board";
import { hourlyRate } from "@/src/candidate/lib/derive";
import { fitChecks, slotsLeft, taskPotential } from "@/src/candidate/lib/tasks";
import { EmptyBlock } from "@/src/shared/kit/EmptyBlock";
import { PageHeader } from "@/src/shared/kit/PageHeader";
import { Panel } from "@/src/shared/kit/Panel";
import { StatCard } from "@/src/shared/kit/StatCard";
import { TaskTypeBadge } from "@/src/shared/kit/StatusBadge";
import { longDate, money, relativeTime } from "@/src/shared/lib/format";
import { Badge, Button, PageBody } from "@/src/shared/marketplace-ui";
import { PACKAGE_BY_ID } from "@/src/shared/mock/packages";
import { BIDDER_ROUTES } from "@/src/shared/routes/bidder";

export function TaskDetailView({ taskId }: { taskId: string }) {
  const { profile, assessments, savedTaskIds, toggleSaved } = useBidderWorkspace();
  const task = BOARD_TASK_BY_ID.get(taskId);
  const hunter = task && HUNTER_BY_ID.get(task.hunterId);

  if (!task || !hunter) {
    return (
      <PageBody>
        <div className="hx-page">
          <EmptyBlock
            icon="search"
            title="Task not found"
            description="It may have been removed by the job hunter."
            action={
              <Button href={BIDDER_ROUTES.board} variant="primary" label="Back to the board" />
            }
          />
        </div>
      </PageBody>
    );
  }

  const potential = taskPotential(task);
  const checks = fitChecks(task, profile, assessments);
  const saved = savedTaskIds.includes(task.id);
  const fitCount = checks.filter((check) => check.ok).length;

  return (
    <PageBody>
      <div className="hx-page">
        <PageHeader
          back={{ href: BIDDER_ROUTES.board, label: "Task board" }}
          eyebrow={hunter.company}
          title={task.title}
          description={task.summary}
          meta={
            <div className="hx-row">
              <TaskTypeBadge type={task.type} />
              {task.status === "closed" ? (
                <Badge label="Closed" tone="neutral" />
              ) : (
                <Badge label={`${slotsLeft(task)} of ${task.slots} slots open`} tone="info" />
              )}
              {task.minLevel && <Badge label={`${task.minLevel}+ only`} tone="purple" />}
              <span className="hx-small hx-muted">Posted {relativeTime(task.postedAt)}</span>
            </div>
          }
          actions={
            <Button
              variant={saved ? "secondary" : "ghost"}
              onClick={() => toggleSaved(task.id)}
              label={saved ? "Saved" : "Save task"}
            >
              <Glyph name="bookmark" size="1em" />
              {saved ? "Saved" : "Save task"}
            </Button>
          }
        />

        <div className="hx-grid hx-grid-stats">
          <StatCard
            label={potential.unit === "per week" ? "Potential weekly pay" : "Batch pay"}
            value={money(potential.amount)}
            icon="download"
            tone="success"
            footnote={`${potential.links} links · after the 8% fee`}
          />
          <StatCard
            label="Expected pace"
            value={`${task.dailyTarget} / day`}
            icon="clock"
            footnote={
              task.endsAt
                ? `Deliver by ${longDate(task.endsAt)}`
                : `Starts ${longDate(task.startsAt)}`
            }
          />
          <StatCard
            label="Quality bar"
            value={`${task.qaBar}%`}
            icon="check"
            tone="warning"
            footnote="QA pass rate expected"
          />
          <StatCard
            label="Your fit"
            value={`${fitCount}/${checks.length}`}
            icon="user"
            tone={fitCount === checks.length ? "success" : "warning"}
            footnote="Requirements you already meet"
          />
        </div>

        <div className="hx-split">
          <div className="hx-stack">
            <Panel title="About this task" subtitle={`Posted by ${hunter.name}`}>
              <div className="hx-stack">
                <p style={{ margin: 0, lineHeight: 1.6 }}>{task.description}</p>
                {task.batchFile && (
                  <div className="bx-callout">
                    <span className="hx-small hx-muted">Batch file</span>
                    <strong>{task.batchFile.name}</strong>
                    <span className="hx-small hx-muted">
                      {task.batchFile.linkCount} links, shared after you are connected
                    </span>
                  </div>
                )}
                {task.perks.length > 0 && (
                  <div className="hx-chip-row">
                    {task.perks.map((perk) => (
                      <span key={perk} className="hx-chip">
                        <Glyph name="sparkle" size="0.95em" /> {perk}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Panel>

            <Panel
              title="Packages and pay"
              subtitle="Harder application systems pay more per link"
              flush
            >
              <div className="bx-table-wrap">
                <table className="bx-table">
                  <thead>
                    <tr>
                      <th>Package</th>
                      <th>Difficulty</th>
                      <th>Volume</th>
                      <th>Pay / link</th>
                      <th>≈ Per hour</th>
                    </tr>
                  </thead>
                  <tbody>
                    {task.packageLines.map((line) => {
                      const tier = PACKAGE_BY_ID.get(line.packageId);
                      return (
                        <tr key={line.packageId}>
                          <td>
                            <strong>{tier?.name}</strong>
                            <span className="hx-small hx-muted bx-block">
                              {tier?.ats.join(", ")}
                            </span>
                          </td>
                          <td>
                            <Badge
                              label={tier?.difficulty ?? "Standard"}
                              tone={
                                tier?.difficulty === "Easy"
                                  ? "success"
                                  : tier?.difficulty === "Advanced"
                                    ? "purple"
                                    : "info"
                              }
                            />
                          </td>
                          <td className="hx-num">
                            {line.quota} {task.type === "permanent" ? "/ week" : "total"}
                          </td>
                          <td className="hx-num">{money(line.rate)}</td>
                          <td className="hx-num">
                            {tier ? `${money(hourlyRate(line.rate, tier.minutesPerLink))}/hr` : "–"}
                            <span className="hx-small hx-muted bx-block">
                              {tier?.minutesPerLink} min per link
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="What the hunter expects" subtitle="Read these before you reach out">
              <div className="hx-stack hx-stack-sm">
                {task.requirements.map((requirement) => (
                  <div key={requirement} className="hx-check-row" data-done="true">
                    <span className="hx-check-mark">
                      <Glyph name="check" size="0.9em" />
                    </span>
                    {requirement}
                  </div>
                ))}
              </div>
            </Panel>

            <Panel
              title="How well you match"
              subtitle="Based on your profile, level and assessments"
            >
              <div className="hx-stack hx-stack-sm">
                {checks.map((check) => (
                  <div key={check.id} className="hx-check-row" data-done={check.ok}>
                    <span className="hx-check-mark">
                      <Glyph name={check.ok ? "check" : "info"} size="0.9em" />
                    </span>
                    <span className="hx-grow">
                      {check.label}
                      {!check.ok && check.hint && (
                        <span className="hx-small hx-faint bx-block">{check.hint}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div className="hx-stack">
            <TaskContactPanel task={task} hunter={hunter} />
            <Panel title="About the job hunter">
              <div className="hx-stack">
                <HunterLine hunter={hunter} size={40} />
                <p className="hx-muted hx-small" style={{ margin: 0 }}>
                  {hunter.headline}
                </p>
                <dl className="hx-kv">
                  <dt>Reviews</dt>
                  <dd>{hunter.reviews}</dd>
                  <dt>Paid on time</dt>
                  <dd>{hunter.paidOnTimeRate}%</dd>
                  <dt>Total paid out</dt>
                  <dd>{money(hunter.totalPaid)}</dd>
                  <dt>Payout schedule</dt>
                  <dd>{hunter.payoutSchedule}</dd>
                  <dt>Typical reply</dt>
                  <dd>{hunter.replyTime}</dd>
                  <dt>Active bidders</dt>
                  <dd>{hunter.bidders}</dd>
                  <dt>Member since</dt>
                  <dd>{longDate(hunter.memberSince)}</dd>
                </dl>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </PageBody>
  );
}
