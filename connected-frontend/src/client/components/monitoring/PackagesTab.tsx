import { Table } from "sid-ui";

import type { StatusCounts } from "@/src/shared/lib/selectors";
import type { PackageTier } from "@/src/shared/types/marketplace";

import { Meter } from "@/src/shared/kit/Meter";
import { Panel } from "@/src/shared/kit/Panel";
import { money } from "@/src/shared/lib/format";
import { Badge } from "@/src/shared/marketplace-ui";

export interface PackageRow extends Record<string, unknown> {
  id: string;
  tier: PackageTier;
  counts: StatusCounts;
  total: number;
  delivered: number;
  avgMinutes: number;
  cost: number;
}

/** Per-package view: how much is assigned, how it is going, and what it costs. */
export function PackagesTab({ rows }: { rows: PackageRow[] }) {
  const visible = rows.filter((row) => row.total > 0);
  return (
    <div className="hx-stack">
      <Panel
        title="Package progress"
        subtitle="Cheaper systems clear faster; harder ones cost more per link"
        flush
      >
        <Table<PackageRow>
          variant="plain"
          caption="Package progress"
          rows={visible}
          rowKey={(row) => row.id}
          empty={<span className="hx-muted">No links have been assigned yet.</span>}
          columns={[
            {
              key: "tier",
              header: "Package",
              sortable: true,
              sortValue: (row) => row.tier.name,
              render: (row) => (
                <div className="hx-list-body">
                  <span className="hx-list-title">{row.tier.name}</span>
                  <span className="hx-list-meta">{row.tier.ats.join(", ")}</span>
                </div>
              ),
            },
            {
              key: "difficulty",
              header: "Difficulty",
              render: (row) => (
                <Badge
                  label={row.tier.difficulty}
                  tone={
                    row.tier.difficulty === "Easy"
                      ? "success"
                      : row.tier.difficulty === "Advanced"
                        ? "error"
                        : "warning"
                  }
                />
              ),
            },
            {
              key: "progress",
              header: "Progress",
              width: "16rem",
              render: (row) => (
                <Meter
                  label={row.tier.name}
                  total={row.total}
                  segments={[
                    { label: "QA passed", value: row.counts.qa_passed, tone: "positive" },
                    { label: "Awaiting QA", value: row.counts.submitted, tone: "soft" },
                    { label: "In progress", value: row.counts.in_progress, tone: "accent" },
                    {
                      label: "Returned or failed",
                      value: row.counts.returned + row.counts.failed,
                      tone: "critical",
                    },
                  ]}
                />
              ),
            },
            {
              key: "total",
              header: "Assigned",
              align: "end",
              sortable: true,
              render: (row) => <span className="hx-num">{row.total}</span>,
            },
            {
              key: "passed",
              header: "QA passed",
              align: "end",
              render: (row) => <span className="hx-num">{row.counts.qa_passed}</span>,
            },
            {
              key: "avgMinutes",
              header: "Min / link",
              align: "end",
              sortable: true,
              render: (row) => (
                <span className="hx-num">
                  {row.avgMinutes ? row.avgMinutes.toFixed(1) : "—"}{" "}
                  <span className="hx-faint">/ {row.tier.minutesPerLink}</span>
                </span>
              ),
            },
            {
              key: "cost",
              header: "Cost so far",
              align: "end",
              sortable: true,
              render: (row) => <strong className="hx-num">{money(row.cost)}</strong>,
            },
          ]}
        />
      </Panel>
    </div>
  );
}
