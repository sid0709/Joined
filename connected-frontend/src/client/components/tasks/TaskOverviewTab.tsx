import { Glyph } from "@joined/design-system";
import { Table } from "@joined/design-system";

import type { StatusCounts } from "@/src/shared/lib/selectors";
import type { ApplicationRecord, Task } from "@/src/shared/types/marketplace";

import { DailyBars } from "@/src/shared/kit/charts/DailyBars";
import { Meter } from "@/src/shared/kit/Meter";
import { Panel } from "@/src/shared/kit/Panel";
import { longDate, money, shortDate } from "@/src/shared/lib/format";
import { dailySeries } from "@/src/shared/lib/selectors";
import { PACKAGE_BY_ID } from "@/src/shared/mock/packages";

interface TaskOverviewTabProps {
  task: Task;
  counts: StatusCounts;
  applications: ApplicationRecord[];
}

interface PackageRow extends Record<string, unknown> {
  id: string;
  name: string;
  ats: string;
  quota: number;
  rate: number;
  listRate: number;
  estimate: number;
}

export function TaskOverviewTab({ task, counts, applications }: TaskOverviewTabProps) {
  const rows: PackageRow[] = task.packageLines.map((line) => {
    const tier = PACKAGE_BY_ID.get(line.packageId);
    return {
      id: line.packageId,
      name: tier?.name ?? line.packageId,
      ats: tier?.ats.join(", ") ?? "",
      quota: line.quota,
      rate: line.rate,
      listRate: tier?.ratePerLink ?? line.rate,
      estimate: line.quota * line.rate,
    };
  });
  const assigned = applications.length;
  const daily = dailySeries(applications, 10, task.dailyTarget);

  return (
    <div className="hx-split">
      <div className="hx-stack">
        <Panel title="About this task">
          <p style={{ margin: 0, lineHeight: 1.6 }}>{task.summary}</p>
          <div className="hx-stack hx-stack-sm">
            <strong className="hx-strong">Bidder requirements</strong>
            <ul className="hx-list" style={{ gap: "var(--space-2)" }}>
              {task.requirements.map((requirement) => (
                <li
                  key={requirement}
                  className="hx-row"
                  style={{ flexWrap: "nowrap", alignItems: "flex-start" }}
                >
                  <span className="hx-star" style={{ color: "var(--color-chart-positive)" }}>
                    <Glyph name="check" />
                  </span>
                  {requirement}
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel
          title="Packages and agreed rates"
          subtitle="Bidders are paid per QA-passed link at these rates"
          flush
        >
          <Table<PackageRow>
            variant="plain"
            caption="Packages and rates"
            rows={rows}
            rowKey={(row) => row.id}
            columns={[
              {
                key: "name",
                header: "Package",
                render: (row) => (
                  <div className="hx-list-body">
                    <span className="hx-list-title">{row.name}</span>
                    <span className="hx-list-meta">{row.ats}</span>
                  </div>
                ),
              },
              {
                key: "quota",
                header: task.type === "permanent" ? "Per week" : "In batch",
                align: "end",
                render: (row) => <span className="hx-num">{row.quota}</span>,
              },
              {
                key: "rate",
                header: "Rate / link",
                align: "end",
                render: (row) => (
                  <span className="hx-num">
                    {money(row.rate)}
                    {row.rate !== row.listRate && (
                      <span className="hx-faint"> (list {money(row.listRate)})</span>
                    )}
                  </span>
                ),
              },
              {
                key: "estimate",
                header: task.type === "permanent" ? "Weekly spend" : "Total",
                align: "end",
                render: (row) => <strong className="hx-num">{money(row.estimate)}</strong>,
              },
            ]}
          />
        </Panel>

        {assigned > 0 && (
          <Panel title="Delivery on this task" subtitle="Applications delivered per day">
            <DailyBars points={daily} />
          </Panel>
        )}
      </div>

      <div className="hx-stack">
        <Panel title="Progress">
          {assigned > 0 ? (
            <>
              <Meter
                large
                label="Task progress"
                total={assigned}
                segments={[
                  { label: "QA passed", value: counts.qa_passed, tone: "positive" },
                  { label: "Awaiting QA", value: counts.submitted, tone: "soft" },
                  { label: "In progress", value: counts.in_progress, tone: "accent" },
                  {
                    label: "Returned or failed",
                    value: counts.returned + counts.failed,
                    tone: "critical",
                  },
                  { label: "Queued", value: counts.queued, tone: "neutral" },
                ]}
              />
              <dl className="hx-kv">
                <dt>Assigned links</dt>
                <dd className="hx-num">{assigned}</dd>
                <dt>QA passed</dt>
                <dd className="hx-num">{counts.qa_passed}</dd>
                <dt>Awaiting QA</dt>
                <dd className="hx-num">{counts.submitted}</dd>
                <dt>Returned or failed</dt>
                <dd className="hx-num">{counts.returned + counts.failed}</dd>
                <dt>Billable so far</dt>
                <dd className="hx-num">
                  {money(counts.qa_passed * (task.packageLines[0]?.rate ?? 0))}
                </dd>
              </dl>
            </>
          ) : (
            <p className="hx-muted" style={{ margin: 0 }}>
              No links have been assigned yet. Connect with a bidder, then assign links from the job
              pool.
            </p>
          )}
        </Panel>

        <Panel title="Terms">
          <dl className="hx-kv">
            <dt>Contract</dt>
            <dd>{task.type === "permanent" ? "Permanent" : "One-time batch"}</dd>
            <dt>Daily target</dt>
            <dd className="hx-num">{task.dailyTarget} links</dd>
            <dt>Bidder slots</dt>
            <dd className="hx-num">{task.bidderSlots}</dd>
            <dt>Budget cap</dt>
            <dd className="hx-num">{money(task.budgetCap)}</dd>
            <dt>Starts</dt>
            <dd>{longDate(task.startsAt)}</dd>
            {task.endsAt && (
              <>
                <dt>Deliver by</dt>
                <dd>{longDate(task.endsAt)}</dd>
              </>
            )}
            <dt>Posted</dt>
            <dd>{shortDate(task.postedAt)}</dd>
            <dt>Board views</dt>
            <dd className="hx-num">{task.views}</dd>
          </dl>
          {task.batchFile && (
            <div className="hx-contact hx-row" style={{ flexWrap: "nowrap" }}>
              <Glyph name="folder" size="1.4em" />
              <div className="hx-list-body">
                <span className="hx-list-title hx-truncate">{task.batchFile.name}</span>
                <span className="hx-list-meta">
                  {task.batchFile.linkCount} links · {task.batchFile.sizeKb} KB
                </span>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
