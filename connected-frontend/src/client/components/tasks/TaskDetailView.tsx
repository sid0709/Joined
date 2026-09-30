"use client";

import { useState } from "react";

import { FeedbackDialog } from "@/src/client/components/monitoring/FeedbackDialog";
import { InquiryCard } from "@/src/client/components/tasks/InquiryCard";
import { TaskAssignmentsTab } from "@/src/client/components/tasks/TaskAssignmentsTab";
import { TaskOverviewTab } from "@/src/client/components/tasks/TaskOverviewTab";
import { TaskTeamTab } from "@/src/client/components/tasks/TaskTeamTab";
import { useHunter } from "@/src/client/context/HunterContext";
import { EmptyBlock } from "@/src/shared/kit/EmptyBlock";
import { PageHeader } from "@/src/shared/kit/PageHeader";
import { TaskStatusBadge, TaskTypeBadge } from "@/src/shared/kit/StatusBadge";
import { Tabs } from "@/src/shared/kit/Tabs";
import { countStatuses } from "@/src/shared/lib/selectors";
import { Banner, Button, PageBody } from "@/src/shared/marketplace-ui";
import { HUNTER_ROUTES } from "@/src/shared/routes/hunter";

type TabKey = "overview" | "inquiries" | "team" | "assignments";

export function TaskDetailView({ taskId }: { taskId: string }) {
  const {
    taskById,
    inquiries,
    bidderById,
    assignments,
    applications,
    setTaskStatus,
    respondToInquiry,
  } = useHunter();
  const [tab, setTab] = useState<TabKey>("overview");
  const [feedbackFor, setFeedbackFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const task = taskById(taskId);

  if (!task) {
    return (
      <PageBody>
        <div className="hx-page">
          <EmptyBlock
            icon="search"
            title="Task not found"
            description="This task may have been removed."
            action={<Button href={HUNTER_ROUTES.tasks} variant="primary" label="Back to tasks" />}
          />
        </div>
      </PageBody>
    );
  }

  const taskInquiries = inquiries.filter((item) => item.taskId === task.id);
  const pending = taskInquiries.filter(
    (item) => item.status === "new" || item.status === "negotiating",
  );
  const members = taskInquiries
    .filter((item) => item.status === "connected")
    .flatMap((inquiry) => {
      const bidder = bidderById(inquiry.bidderId);
      return bidder ? [{ inquiry, bidder }] : [];
    });
  const taskAssignments = assignments.filter((assignment) => assignment.taskId === task.id);
  const taskApplications = applications.filter((application) => application.taskId === task.id);
  const live = task.status === "in_progress" || task.status === "open" || task.status === "paused";

  const decide = (inquiryId: string, decision: "accept" | "decline") => {
    const result = respondToInquiry(inquiryId, decision);
    setError(result.ok ? null : (result.error ?? "Could not update the inquiry."));
  };

  return (
    <PageBody>
      <div className="hx-page">
        <PageHeader
          back={{ href: HUNTER_ROUTES.tasks, label: "All tasks" }}
          eyebrow={task.type === "permanent" ? "Permanent contract" : "One-time batch"}
          title={task.title}
          meta={
            <div className="hx-row">
              <TaskTypeBadge type={task.type} />
              <TaskStatusBadge status={task.status} />
            </div>
          }
          actions={
            <>
              {task.status === "draft" && (
                <Button
                  variant="primary"
                  label="Publish to task board"
                  onClick={() => setTaskStatus(task.id, "open")}
                />
              )}
              {task.status === "paused" && (
                <Button
                  variant="secondary"
                  label="Resume task"
                  onClick={() => setTaskStatus(task.id, members.length ? "in_progress" : "open")}
                />
              )}
              {(task.status === "in_progress" || task.status === "open") && (
                <Button
                  variant="secondary"
                  label="Pause"
                  onClick={() => setTaskStatus(task.id, "paused")}
                />
              )}
              {live && (
                <Button
                  variant="ghost"
                  label="Mark completed"
                  onClick={() => setTaskStatus(task.id, "completed")}
                />
              )}
              {live && members.length > 0 && (
                <Button
                  href={`${HUNTER_ROUTES.pool}?task=${task.id}`}
                  variant="primary"
                  label="Assign links"
                />
              )}
            </>
          }
        />

        <Tabs
          label="Task sections"
          value={tab}
          onChange={setTab}
          options={[
            { value: "overview", label: "Overview" },
            {
              value: "inquiries",
              label: `Inquiries${pending.length ? ` (${pending.length})` : ""}`,
            },
            { value: "team", label: `Bidders (${members.length}/${task.bidderSlots})` },
            { value: "assignments", label: `Assignments (${taskAssignments.length})` },
          ]}
        />

        {error && <Banner tone="danger" title={error} />}

        {tab === "overview" && (
          <TaskOverviewTab
            task={task}
            counts={countStatuses(taskApplications)}
            applications={taskApplications}
          />
        )}

        {tab === "inquiries" &&
          (taskInquiries.length ? (
            <div className="hx-grid hx-grid-2">
              {[...pending, ...taskInquiries.filter((item) => !pending.includes(item))].map(
                (inquiry) => {
                  const bidder = bidderById(inquiry.bidderId);
                  return bidder ? (
                    <InquiryCard
                      key={inquiry.id}
                      inquiry={inquiry}
                      bidder={bidder}
                      task={task}
                      onDecision={(decision) => decide(inquiry.id, decision)}
                    />
                  ) : null;
                },
              )}
            </div>
          ) : (
            <EmptyBlock
              icon="mail"
              title="No inquiries yet"
              description={
                task.status === "draft"
                  ? "Publish this task and bidders can contact you from the task board."
                  : "Bidders who view this task will contact you here. Reply fast to win the best ones."
              }
            />
          ))}

        {tab === "team" && (
          <TaskTeamTab
            task={task}
            members={members}
            applications={taskApplications}
            onFeedback={setFeedbackFor}
          />
        )}
        {tab === "assignments" && (
          <TaskAssignmentsTab assignments={taskAssignments} applications={taskApplications} />
        )}

        <FeedbackDialog bidderId={feedbackFor} onClose={() => setFeedbackFor(null)} />
      </div>
    </PageBody>
  );
}
