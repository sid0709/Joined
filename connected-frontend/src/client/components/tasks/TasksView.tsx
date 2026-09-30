"use client";

import { useMemo, useState } from "react";

import { TaskCard } from "@/src/client/components/tasks/TaskCard";
import { EmptyBlock } from "@/src/client/components/ui/EmptyBlock";
import { PageHeader } from "@/src/client/components/ui/PageHeader";
import { StatCard } from "@/src/client/components/ui/StatCard";
import { useHunterMetrics } from "@/src/client/hooks/useHunterMetrics";
import { Button, Input, PageBody, Select } from "@/src/shared/marketplace-ui";
import { HUNTER_ROUTES } from "@/src/shared/routes/hunter";

export function TasksView() {
  const { taskRows } = useHunterMetrics();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");

  const visible = useMemo(
    () =>
      taskRows.filter(
        ({ task }) =>
          (status === "all" || task.status === status) &&
          (type === "all" || task.type === type) &&
          `${task.title} ${task.summary}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [taskRows, query, status, type],
  );

  const count = (predicate: (row: (typeof taskRows)[number]) => boolean) =>
    taskRows.filter(predicate).length;
  const inquiries = taskRows.reduce((sum, row) => sum + row.pending.length, 0);

  return (
    <PageBody>
      <div className="hx-page">
        <PageHeader
          eyebrow="Tasks"
          title="Your task board"
          description="Tasks are the work you offer to bidders. Bidders browse the board and contact you; once you connect, you assign links from the job pool."
          actions={<Button href={HUNTER_ROUTES.newTask} variant="primary" label="Post a task" />}
        />

        <div className="hx-grid hx-grid-stats">
          <StatCard
            label="Open for bidders"
            value={count((row) => row.task.status === "open")}
            icon="users"
            footnote="Visible on the task board"
          />
          <StatCard
            label="In progress"
            value={count((row) => row.task.status === "in_progress")}
            icon="play"
            tone="success"
            footnote="With connected bidders"
          />
          <StatCard
            label="Bidder inquiries"
            value={inquiries}
            icon="mail"
            tone="warning"
            footnote="Waiting for your reply"
          />
          <StatCard
            label="Drafts"
            value={count((row) => row.task.status === "draft")}
            icon="edit"
            footnote="Not yet published"
          />
        </div>

        <div className="hx-filters">
          <div className="hx-filter-wide">
            <Input
              label="Search tasks"
              placeholder="Search by title or description"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <Select label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="open">Open for bidders</option>
            <option value="in_progress">In progress</option>
            <option value="paused">Paused</option>
            <option value="draft">Draft</option>
            <option value="completed">Completed</option>
          </Select>
          <Select
            label="Contract type"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="all">All types</option>
            <option value="permanent">Permanent contract</option>
            <option value="one_time">One-time batch</option>
          </Select>
        </div>

        {visible.length ? (
          <div className="hx-grid hx-grid-2">
            {visible.map((row) => (
              <TaskCard
                key={row.task.id}
                task={row.task}
                counts={row.counts}
                assigned={row.assigned}
                connected={row.connected}
                pending={row.pending}
              />
            ))}
          </div>
        ) : (
          <EmptyBlock
            icon="search"
            title="No tasks match these filters"
            description="Clear the search or post a new task for bidders."
            action={<Button href={HUNTER_ROUTES.newTask} variant="primary" label="Post a task" />}
          />
        )}
      </div>
    </PageBody>
  );
}
