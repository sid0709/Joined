import type { TaskPackageLine, TaskType } from "@/src/client/types/hunter";

import { Panel } from "@/src/client/components/ui/Panel";
import { TaskTypeBadge } from "@/src/client/components/ui/StatusBadge";
import { PACKAGE_BY_ID } from "@/src/client/data/packages";
import { money } from "@/src/client/lib/format";

interface TaskPreviewProps {
  type: TaskType;
  title: string;
  summary: string;
  requirements: string[];
  lines: TaskPackageLine[];
  dailyTarget: number;
  bidderSlots: number;
}

export function estimateSpend(lines: TaskPackageLine[]) {
  return lines.reduce((sum, line) => sum + line.quota * line.rate, 0);
}

/** What bidders will see on the task board, plus what it will cost. */
export function TaskPreview({
  type,
  title,
  summary,
  requirements,
  lines,
  dailyTarget,
  bidderSlots,
}: TaskPreviewProps) {
  const total = estimateSpend(lines);
  const links = lines.reduce((sum, line) => sum + line.quota, 0);
  return (
    <Panel title="Bidder preview" subtitle="How this appears on the task board" tinted>
      <div className="hx-stack hx-stack-sm">
        <div className="hx-row">
          <TaskTypeBadge type={type} />
        </div>
        <h3 className="hx-task-title">{title || "Untitled task"}</h3>
        <p className="hx-task-summary" style={{ WebkitLineClamp: 4 }}>
          {summary || "Describe the work so bidders know what to expect."}
        </p>
      </div>
      {requirements.length > 0 && (
        <ul className="hx-small hx-muted" style={{ margin: 0, paddingLeft: "var(--space-5)" }}>
          {requirements.slice(0, 4).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      <div className="hx-chip-row">
        {lines.map((line) => (
          <span key={line.packageId} className="hx-chip">
            {PACKAGE_BY_ID.get(line.packageId)?.name} · {money(line.rate)}
          </span>
        ))}
      </div>
      <dl className="hx-kv">
        <dt>{type === "permanent" ? "Links per week" : "Links in batch"}</dt>
        <dd className="hx-num">{links}</dd>
        <dt>Daily target</dt>
        <dd className="hx-num">{dailyTarget}</dd>
        <dt>Bidder slots</dt>
        <dd className="hx-num">{bidderSlots}</dd>
        <dt>{type === "permanent" ? "Estimated weekly spend" : "Estimated total"}</dt>
        <dd className="hx-num">{money(total)}</dd>
      </dl>
    </Panel>
  );
}
