import { Table } from "@openseat/design-system";

import type { StatusCounts } from "@/src/shared/lib/selectors";
import type { Bidder } from "@/src/shared/types/marketplace";

import { Meter } from "@/src/shared/kit/Meter";
import { Panel } from "@/src/shared/kit/Panel";
import { Person } from "@/src/shared/kit/Person";
import { relativeTime, percent } from "@/src/shared/lib/format";
import { Badge, Button } from "@/src/shared/marketplace-ui";

export interface BidderRow extends Record<string, unknown> {
  id: string;
  bidder: Bidder;
  counts: StatusCounts;
  delivered: number;
  activeCount: number;
  today: number;
  target: number;
  qa: number;
  avgMinutes: number;
  lastActive?: string;
}

interface BiddersTabProps {
  rows: BidderRow[];
  onFeedback: (bidderId: string) => void;
}

export function BiddersTab({ rows, onFeedback }: BiddersTabProps) {
  return (
    <Panel
      title="Bidder performance"
      subtitle="Pace, quality, and speed for every connected bidder"
      flush
    >
      <Table<BidderRow>
        variant="plain"
        caption="Bidder performance"
        rows={rows}
        rowKey={(row) => row.id}
        columns={[
          {
            key: "bidder",
            header: "Bidder",
            sortable: true,
            sortValue: (row) => row.bidder.name,
            render: (row) => (
              <Person
                name={row.bidder.name}
                detail={`${row.bidder.level} · ${row.activeCount} active`}
              />
            ),
          },
          {
            key: "today",
            header: "Today vs target",
            sortable: true,
            width: "14rem",
            render: (row) => (
              <div className="hx-stack hx-stack-sm">
                <Meter
                  label={`${row.bidder.name} today`}
                  total={Math.max(row.target, row.today, 1)}
                  segments={[
                    {
                      label: "Delivered today",
                      value: row.today,
                      tone: row.today >= row.target ? "positive" : "accent",
                    },
                  ]}
                />
                <span className="hx-small hx-muted hx-num">
                  {row.today} of {row.target || "—"} today
                </span>
              </div>
            ),
          },
          {
            key: "delivered",
            header: "Delivered",
            align: "end",
            sortable: true,
            render: (row) => <span className="hx-num">{row.delivered}</span>,
          },
          {
            key: "qa",
            header: "QA pass",
            align: "end",
            sortable: true,
            render: (row) => (
              <Badge
                label={percent(row.qa, 0)}
                tone={row.qa >= 90 ? "success" : row.qa >= 80 ? "warning" : "error"}
              />
            ),
          },
          {
            key: "avgMinutes",
            header: "Avg. min / link",
            align: "end",
            sortable: true,
            render: (row) => (
              <span className="hx-num">{row.avgMinutes ? row.avgMinutes.toFixed(1) : "—"}</span>
            ),
          },
          {
            key: "lastActive",
            header: "Last active",
            render: (row) => <span>{row.lastActive ? relativeTime(row.lastActive) : "—"}</span>,
          },
          {
            key: "actions",
            header: "",
            align: "end",
            render: (row) => (
              <Button
                variant="ghost"
                size="sm"
                label="Feedback"
                onClick={() => onFeedback(row.bidder.id)}
              />
            ),
          },
        ]}
      />
    </Panel>
  );
}
