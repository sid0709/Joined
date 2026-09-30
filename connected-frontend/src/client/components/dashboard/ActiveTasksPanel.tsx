import Link from "next/link";

import { useHunter } from "@/src/client/context/HunterContext";
import { useHunterMetrics } from "@/src/client/hooks/useHunterMetrics";
import { Meter } from "@/src/shared/kit/Meter";
import { Panel } from "@/src/shared/kit/Panel";
import { AvatarStack } from "@/src/shared/kit/Person";
import { TaskStatusBadge, TaskTypeBadge } from "@/src/shared/kit/StatusBadge";
import { Button } from "@/src/shared/marketplace-ui";
import { HUNTER_ROUTES } from "@/src/shared/routes/hunter";

export function ActiveTasksPanel() {
  const { bidderById } = useHunter();
  const { taskRows } = useHunterMetrics();
  const rows = taskRows.filter(
    (row) => row.task.status === "in_progress" || row.task.status === "open",
  );

  return (
    <Panel
      title="Live tasks"
      subtitle="Progress per task, from links assigned to QA-passed"
      actions={<Button href={HUNTER_ROUTES.tasks} variant="ghost" size="sm" label="All tasks" />}
      flush
    >
      <ul className="hx-list">
        {rows.map(({ task, counts, assigned, connected, pending }) => (
          <li key={task.id}>
            <Link
              className="hx-list-item"
              href={HUNTER_ROUTES.task(task.id)}
              style={{ alignItems: "flex-start" }}
            >
              <span className="hx-list-body" style={{ gap: "var(--space-2)" }}>
                <span className="hx-row">
                  <span className="hx-list-title">{task.title}</span>
                  <TaskTypeBadge type={task.type} />
                  <TaskStatusBadge status={task.status} />
                </span>
                {assigned > 0 ? (
                  <Meter
                    label={task.title}
                    total={assigned}
                    segments={[
                      { label: "QA passed", value: counts.qa_passed, tone: "positive" },
                      { label: "Awaiting QA", value: counts.submitted, tone: "soft" },
                      {
                        label: "Returned or failed",
                        value: counts.returned + counts.failed,
                        tone: "critical",
                      },
                    ]}
                  />
                ) : (
                  <span className="hx-list-meta">No links assigned yet</span>
                )}
                <span className="hx-list-meta">
                  {assigned > 0
                    ? `${counts.qa_passed} of ${assigned} links passed QA`
                    : `${pending.length} bidder inquiries waiting`}
                </span>
              </span>
              <AvatarStack
                names={connected.map((item) => bidderById(item.bidderId)?.name ?? "Bidder")}
              />
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
