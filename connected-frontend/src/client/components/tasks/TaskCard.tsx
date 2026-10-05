import { Glyph } from "sid-ui";
import Link from "next/link";

import type { StatusCounts } from "@/src/shared/lib/selectors";
import type { Inquiry, Task } from "@/src/shared/types/marketplace";

import { useHunter } from "@/src/client/context/HunterContext";
import { Meter } from "@/src/shared/kit/Meter";
import { AvatarStack } from "@/src/shared/kit/Person";
import { TaskStatusBadge, TaskTypeBadge } from "@/src/shared/kit/StatusBadge";
import { money, plural, relativeTime } from "@/src/shared/lib/format";
import { PACKAGE_BY_ID } from "@/src/shared/mock/packages";
import { HUNTER_ROUTES } from "@/src/shared/routes/hunter";

interface TaskCardProps {
  task: Task;
  counts: StatusCounts;
  assigned: number;
  connected: Inquiry[];
  pending: Inquiry[];
}

export function TaskCard({ task, counts, assigned, connected, pending }: TaskCardProps) {
  const { bidderById } = useHunter();
  const unread = pending.reduce((sum, item) => sum + item.unread, 0);

  return (
    <Link href={HUNTER_ROUTES.task(task.id)} className="hx-task">
      <div className="hx-stack hx-stack-sm">
        <div className="hx-row">
          <TaskTypeBadge type={task.type} />
          <TaskStatusBadge status={task.status} />
        </div>
        <h3 className="hx-task-title">{task.title}</h3>
        <p className="hx-task-summary">{task.summary}</p>
      </div>

      <div className="hx-chip-row">
        {task.packageLines.map((line) => (
          <span key={line.packageId} className="hx-chip">
            {PACKAGE_BY_ID.get(line.packageId)?.name} · {money(line.rate)}/link
          </span>
        ))}
      </div>

      {assigned > 0 ? (
        <div className="hx-stack hx-stack-sm">
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
          <span className="hx-small hx-muted">
            {counts.qa_passed} of {assigned} links passed QA
          </span>
        </div>
      ) : (
        <span className="hx-small hx-muted">
          {task.status === "draft"
            ? "Not published yet"
            : task.type === "one_time" && task.batchFile
              ? `${task.batchFile.linkCount} links in ${task.batchFile.name}`
              : "No links assigned yet"}
        </span>
      )}

      <div className="hx-task-foot">
        <span className="hx-row" style={{ gap: "var(--space-2)" }}>
          <AvatarStack
            names={connected.map((item) => bidderById(item.bidderId)?.name ?? "Bidder")}
            size={24}
          />
          <span>
            {connected.length}/{task.bidderSlots} bidders
          </span>
        </span>
        <span className="hx-row" style={{ gap: "var(--space-3)" }}>
          {pending.length > 0 && (
            <span className="hx-strong" style={{ color: "var(--color-text-accent)" }}>
              <Glyph name="mail" /> {plural(pending.length, "inquiry", "inquiries")}
              {unread > 0 ? ` · ${unread} unread` : ""}
            </span>
          )}
          <span>
            <Glyph name="eye" /> {task.views}
          </span>
          <span>{relativeTime(task.postedAt)}</span>
        </span>
      </div>
    </Link>
  );
}
