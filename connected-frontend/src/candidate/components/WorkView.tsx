"use client";

import { Glyph } from "sid-ui";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import type { ApplicationStatus, BidderApplication } from "@/src/candidate/types/workspace";

import { AskHunterDialog } from "@/src/candidate/components/AskHunterDialog";
import { SubmitDialog } from "@/src/candidate/components/SubmitDialog";
import { HunterLine } from "@/src/candidate/components/ui/HunterLine";
import { ProgressRing } from "@/src/candidate/components/ui/ProgressRing";
import { useBidderWorkspace } from "@/src/candidate/context/BidderWorkspaceContext";
import { BOARD_TASK_BY_ID, HUNTER_BY_ID } from "@/src/candidate/data/board";
import { applicationEarning } from "@/src/candidate/lib/derive";
import { EmptyBlock } from "@/src/shared/kit/EmptyBlock";
import { Meter } from "@/src/shared/kit/Meter";
import { PageHeader } from "@/src/shared/kit/PageHeader";
import { Panel } from "@/src/shared/kit/Panel";
import { StatCard } from "@/src/shared/kit/StatCard";
import { APPLICATION_STATUS_LABEL, ApplicationStatusBadge } from "@/src/shared/kit/StatusBadge";
import { Tabs } from "@/src/shared/kit/Tabs";
import { dayKey, daysUntil, money, relativeTime, shortDate } from "@/src/shared/lib/format";
import { countStatuses } from "@/src/shared/lib/selectors";
import { Badge, Banner, Button, PageBody, Select } from "@/src/shared/marketplace-ui";
import { MOCK_TODAY } from "@/src/shared/mock/clock";
import { PACKAGE_BY_ID } from "@/src/shared/mock/packages";
import { POOL_BY_ID } from "@/src/shared/mock/pool";
import { BIDDER_ROUTES } from "@/src/shared/routes/bidder";

type Filter = "all" | "todo" | "review" | "fix" | "passed";
const PAGE_SIZE = 12;

const PRIORITY: Record<ApplicationStatus, number> = {
  returned: 0,
  in_progress: 1,
  queued: 2,
  submitted: 3,
  failed: 4,
  qa_passed: 5,
};

const FILTERS: Record<Filter, (status: ApplicationStatus) => boolean> = {
  all: () => true,
  todo: (status) => status === "queued" || status === "in_progress",
  review: (status) => status === "submitted",
  fix: (status) => status === "returned" || status === "failed",
  passed: (status) => status === "qa_passed",
};

export function WorkView() {
  const params = useSearchParams();
  const { assignments, applications, engagements, startApplication } = useBidderWorkspace();
  const [desk, setDesk] = useState(params.get("desk") ?? "all");
  const [filter, setFilter] = useState<Filter>("all");
  const [showAll, setShowAll] = useState(false);
  const [submitting, setSubmitting] = useState<BidderApplication | null>(null);
  const [asking, setAsking] = useState<BidderApplication | null>(null);

  const activeAssignments = assignments.filter((item) => item.status === "active");
  const scoped =
    desk === "all" ? applications : applications.filter((item) => item.assignmentId === desk);
  const scopedAssignments =
    desk === "all" ? activeAssignments : assignments.filter((item) => item.id === desk);
  const counts = countStatuses(scoped);
  const todayCount = scoped.filter(
    (item) =>
      ["submitted", "qa_passed", "returned"].includes(item.status) &&
      dayKey(item.updatedAt) === MOCK_TODAY,
  ).length;
  const dailyTarget = scopedAssignments.reduce((sum, item) => sum + item.dailyTarget, 0);
  const earned = scoped
    .filter((item) => item.status === "qa_passed")
    .reduce((sum, item) => sum + applicationEarning(item, assignments), 0);

  const rows = useMemo(
    () =>
      scoped
        .filter((item) => FILTERS[filter](item.status))
        .sort(
          (a, b) =>
            PRIORITY[a.status] - PRIORITY[b.status] || b.updatedAt.localeCompare(a.updatedAt),
        ),
    [scoped, filter],
  );
  const shown = showAll ? rows : rows.slice(0, PAGE_SIZE);

  const waiting = engagements.filter(
    (engagement) =>
      engagement.status === "connected" &&
      !assignments.some((assignment) => assignment.engagementId === engagement.id),
  );
  const selected = assignments.find((item) => item.id === desk);
  const selectedTask = selected && BOARD_TASK_BY_ID.get(selected.taskId);
  const selectedHunter = selectedTask && HUNTER_BY_ID.get(selectedTask.hunterId);

  return (
    <PageBody>
      <div className="hx-page">
        <PageHeader
          eyebrow="My work"
          title="Your applications, desk by desk"
          description="Work through the links each hunter assigned you. Submit with evidence, fix anything returned, and watch approved links turn into earnings."
          actions={
            <>
              <Button href={BIDDER_ROUTES.reviews} variant="secondary" label="Reviews" />
              <Button href={BIDDER_ROUTES.messages} variant="primary" label="Message hunters" />
            </>
          }
        />

        {waiting.map((engagement) => {
          const task = BOARD_TASK_BY_ID.get(engagement.taskId);
          return (
            <Banner
              key={engagement.id}
              tone="info"
              title={`Connected to ${task?.title}`}
              description="The hunter will assign your first links shortly. You'll get a notification when they land."
            />
          );
        })}

        <div className="bx-desks" role="group" aria-label="Choose a desk">
          <button
            type="button"
            className="hx-choice"
            aria-pressed={desk === "all"}
            onClick={() => setDesk("all")}
          >
            <span className="hx-strong">All active desks</span>
            <span className="hx-small hx-muted">
              {activeAssignments.length} assignments ·{" "}
              {
                applications.filter(
                  (item) => item.status === "queued" || item.status === "in_progress",
                ).length
              }{" "}
              links to do
            </span>
          </button>
          {assignments.map((assignment) => {
            const task = BOARD_TASK_BY_ID.get(assignment.taskId);
            const hunter = task && HUNTER_BY_ID.get(task.hunterId);
            const own = countStatuses(
              applications.filter((item) => item.assignmentId === assignment.id),
            );
            const total = assignment.jobIds.length;
            return (
              <button
                key={assignment.id}
                type="button"
                className="hx-choice"
                aria-pressed={desk === assignment.id}
                onClick={() => setDesk(assignment.id)}
              >
                <span className="hx-row hx-row-between" style={{ flexWrap: "nowrap" }}>
                  <span className="hx-strong hx-truncate">{hunter?.company}</span>
                  {assignment.status === "completed" && <Badge label="Completed" tone="neutral" />}
                </span>
                <span className="hx-small hx-muted hx-truncate">
                  {PACKAGE_BY_ID.get(assignment.packageId)?.name} · {money(assignment.rate)}/link
                </span>
                <Meter
                  label={task?.title ?? "Assignment"}
                  total={total}
                  segments={[
                    { label: "QA passed", value: own.qa_passed, tone: "positive" },
                    { label: "Awaiting QA", value: own.submitted, tone: "soft" },
                    { label: "Returned", value: own.returned + own.failed, tone: "critical" },
                  ]}
                />
                <span className="hx-small hx-muted">
                  {own.qa_passed} of {total} passed
                  {assignment.status === "active" && ` · due ${shortDate(assignment.dueAt)}`}
                </span>
              </button>
            );
          })}
        </div>

        <div className="bx-summary">
          <Panel title="Today" subtitle={desk === "all" ? "Across all desks" : "For this desk"}>
            <ProgressRing
              value={todayCount}
              total={Math.max(dailyTarget, 1)}
              label="Links submitted today"
              caption={dailyTarget ? `Daily target ${dailyTarget} links` : "No daily target"}
            />
          </Panel>
          <div className="hx-grid hx-grid-stats bx-summary-stats">
            <StatCard
              label="To do"
              value={counts.queued + counts.in_progress}
              icon="list"
              footnote={`${counts.in_progress} in progress`}
            />
            <StatCard
              label="Awaiting QA"
              value={counts.submitted}
              icon="eye"
              tone="warning"
              footnote="Hunter is reviewing"
            />
            <StatCard
              label="Needs your fix"
              value={counts.returned + counts.failed}
              icon="refresh"
              tone={counts.returned + counts.failed ? "danger" : "success"}
              footnote="Correct and resubmit"
            />
            <StatCard
              label="Earned from QA-passed"
              value={money(earned)}
              icon="download"
              tone="success"
              footnote={`${counts.qa_passed} links, after the 8% fee`}
            />
          </div>
        </div>

        {selected && selectedTask && selectedHunter && (
          <Panel
            title="Desk rules"
            subtitle={`${selectedTask.title} · due ${shortDate(selected.dueAt)}`}
          >
            <div className="bx-rules">
              <div className="hx-stack hx-stack-sm">
                <HunterLine hunter={selectedHunter} />
                <p className="hx-muted" style={{ margin: 0 }}>
                  {selected.note}
                </p>
                <div className="hx-row">
                  <Button
                    href={BIDDER_ROUTES.thread(selected.engagementId)}
                    variant="secondary"
                    size="sm"
                    label="Open chat"
                  />
                  <span className="hx-small hx-muted">
                    {daysUntil(selected.dueAt) >= 0
                      ? `${daysUntil(selected.dueAt)} days left`
                      : "Past due"}
                  </span>
                </div>
              </div>
              <div className="hx-stack hx-stack-sm">
                {selectedTask.requirements.slice(0, 4).map((requirement) => (
                  <div key={requirement} className="hx-check-row" data-done="true">
                    <span className="hx-check-mark">
                      <Glyph name="check" size="0.9em" />
                    </span>
                    {requirement}
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        )}

        <div className="hx-toolbar">
          <Tabs
            label="Filter links"
            value={filter}
            onChange={(next) => {
              setFilter(next);
              setShowAll(false);
            }}
            options={[
              { value: "all", label: `All (${scoped.length})` },
              { value: "todo", label: `To do (${counts.queued + counts.in_progress})` },
              { value: "review", label: `In review (${counts.submitted})` },
              { value: "fix", label: `Needs fix (${counts.returned + counts.failed})` },
              { value: "passed", label: `Passed (${counts.qa_passed})` },
            ]}
          />
          <div style={{ minWidth: "14rem" }}>
            <Select
              label="Desk"
              value={desk}
              onChange={(event) => {
                setDesk(event.target.value);
                setShowAll(false);
              }}
            >
              <option value="all">All active desks</option>
              {assignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {PACKAGE_BY_ID.get(assignment.packageId)?.name} ·{" "}
                  {
                    HUNTER_BY_ID.get(BOARD_TASK_BY_ID.get(assignment.taskId)?.hunterId ?? "")
                      ?.company
                  }
                </option>
              ))}
            </Select>
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyBlock
            icon="list"
            title="No links in this view"
            description="Try another filter, or ask a hunter for more links in chat."
          />
        ) : (
          <Panel flush>
            <div className="bx-table-wrap">
              <table className="bx-table bx-work">
                <thead>
                  <tr>
                    <th>Company and role</th>
                    <th>System</th>
                    <th>Pay</th>
                    <th>Status</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((application) => {
                    const job = POOL_BY_ID.get(application.jobId);
                    const assignment = assignments.find(
                      (item) => item.id === application.assignmentId,
                    );
                    return (
                      <tr key={application.id}>
                        <td>
                          <strong>{job?.company}</strong>
                          <span className="hx-small hx-muted bx-block">{job?.title}</span>
                          <span className="hx-small hx-faint bx-block">
                            {job?.location} · {job?.workplace}
                          </span>
                          {application.status === "returned" && application.issue && (
                            <span className="bx-issue">
                              <Glyph name="info" size="0.95em" /> {application.issue}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="hx-chip">{job?.ats}</span>
                        </td>
                        <td className="hx-num">
                          {money(assignment?.rate ?? 0)}
                          <span className="hx-small hx-muted bx-block">
                            {application.status === "qa_passed" ? "Approved" : "on approval"}
                          </span>
                        </td>
                        <td>
                          <ApplicationStatusBadge status={application.status} />
                          <span className="hx-small hx-faint bx-block">
                            {application.status === "queued"
                              ? `Assigned ${relativeTime(application.updatedAt)}`
                              : relativeTime(application.updatedAt)}
                          </span>
                        </td>
                        <td>
                          <div className="bx-actions">
                            {job &&
                              application.status !== "qa_passed" &&
                              application.status !== "submitted" && (
                                <Button
                                  href={job.applyUrl}
                                  variant="ghost"
                                  size="sm"
                                  label="Open link"
                                />
                              )}
                            {application.status === "queued" && (
                              <Button
                                variant="primary"
                                size="sm"
                                label="Start"
                                onClick={() => startApplication(application.id)}
                              />
                            )}
                            {(application.status === "in_progress" ||
                              application.status === "returned") && (
                              <Button
                                variant="primary"
                                size="sm"
                                label={
                                  application.status === "returned" ? "Fix and resubmit" : "Submit"
                                }
                                onClick={() => setSubmitting(application)}
                              />
                            )}
                            {(application.status === "queued" ||
                              application.status === "in_progress" ||
                              application.status === "returned") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                label="Ask"
                                onClick={() => setAsking(application)}
                              />
                            )}
                            {(application.status === "submitted" ||
                              application.status === "qa_passed") &&
                              application.confirmation && (
                                <span className="hx-small hx-muted">
                                  {application.confirmation}
                                </span>
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {rows.length > PAGE_SIZE && (
              <div className="hx-row bx-more">
                <Button
                  variant="ghost"
                  label={showAll ? "Show fewer" : `Show all ${rows.length} links`}
                  onClick={() => setShowAll((value) => !value)}
                />
              </div>
            )}
          </Panel>
        )}

        <p className="hx-small hx-muted" style={{ margin: 0 }}>
          Status key: {Object.values(APPLICATION_STATUS_LABEL).join(" · ")}
        </p>
      </div>

      <SubmitDialog application={submitting} onClose={() => setSubmitting(null)} />
      <AskHunterDialog application={asking} onClose={() => setAsking(null)} />
    </PageBody>
  );
}
