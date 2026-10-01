import { Glyph } from "@joined/design-system";
import Link from "next/link";

import type { BoardHunter, BoardTask, Engagement } from "@/src/candidate/types/workspace";

import { HunterLine } from "@/src/candidate/components/ui/HunterLine";
import { EngagementBadge } from "@/src/candidate/components/ui/StatusBadges";
import { slotsLeft, taskPotential } from "@/src/candidate/lib/tasks";
import { TaskTypeBadge } from "@/src/shared/kit/StatusBadge";
import { money, relativeTime } from "@/src/shared/lib/format";
import { Badge, Button } from "@/src/shared/marketplace-ui";
import { PACKAGE_BY_ID } from "@/src/shared/mock/packages";
import { BIDDER_ROUTES } from "@/src/shared/routes/bidder";

interface TaskBoardCardProps {
  task: BoardTask;
  hunter: BoardHunter;
  engagement?: Engagement;
  saved: boolean;
  onToggleSaved: () => void;
}

export function TaskBoardCard({
  task,
  hunter,
  engagement,
  saved,
  onToggleSaved,
}: TaskBoardCardProps) {
  const potential = taskPotential(task);
  const left = slotsLeft(task);
  return (
    <article className="hx-task" data-closed={task.status === "closed"}>
      <div className="hx-row hx-row-between">
        <HunterLine hunter={hunter} />
        <button
          type="button"
          className="bx-icon-button"
          aria-pressed={saved}
          aria-label={saved ? "Remove from saved tasks" : "Save task"}
          onClick={onToggleSaved}
        >
          <Glyph name="bookmark" size="1.15em" />
        </button>
      </div>

      <div className="hx-stack hx-stack-sm">
        <div className="hx-row">
          <TaskTypeBadge type={task.type} />
          {task.status === "closed" ? (
            <Badge label="Closed" tone="neutral" />
          ) : left <= 1 ? (
            <Badge label="1 slot left" tone="warning" />
          ) : (
            <Badge label={`${left} slots open`} tone="info" />
          )}
          {engagement && <EngagementBadge status={engagement.status} />}
        </div>
        <h3 className="hx-task-title">
          <Link href={BIDDER_ROUTES.task(task.id)} className="bx-title-link">
            {task.title}
          </Link>
        </h3>
        <p className="hx-task-summary">{task.summary}</p>
      </div>

      <div className="hx-chip-row">
        {task.packageLines.map((line) => (
          <span key={line.packageId} className="hx-chip">
            {PACKAGE_BY_ID.get(line.packageId)?.name} · {money(line.rate)}/link
          </span>
        ))}
      </div>

      <div className="bx-earn">
        <div>
          <span className="bx-earn-value">{money(potential.amount)}</span>
          <span className="hx-small hx-muted">
            {" "}
            {potential.unit} · {potential.links} links
          </span>
        </div>
        <span className="hx-small hx-muted">After the 8% fee</span>
      </div>

      <div className="hx-task-foot">
        <span>
          {task.applicants} applicants · Posted {relativeTime(task.postedAt)}
        </span>
        <span className="hx-row" style={{ gap: "var(--space-2)" }}>
          <Button
            href={BIDDER_ROUTES.task(task.id)}
            variant="secondary"
            size="sm"
            label="View task"
          />
          {engagement ? (
            <Button
              href={BIDDER_ROUTES.thread(engagement.id)}
              variant="primary"
              size="sm"
              label="Open chat"
            />
          ) : (
            task.status !== "closed" && (
              <Button
                href={`${BIDDER_ROUTES.task(task.id)}#contact`}
                variant="primary"
                size="sm"
                label="Contact hunter"
              />
            )
          )}
        </span>
      </div>
    </article>
  );
}
