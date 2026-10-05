import { Table } from "sid-ui";

import type { Inquiry } from "@/src/shared/types/marketplace";

import { useHunter } from "@/src/client/context/HunterContext";
import { STAGE_TITLE } from "@/src/client/data/pipeline";
import { isUpcoming, displayClock } from "@/src/client/lib/interviews";
import { Person } from "@/src/shared/kit/Person";
import { money, relativeTime, shortDate } from "@/src/shared/lib/format";
import { Badge } from "@/src/shared/marketplace-ui";

interface Row extends Record<string, unknown> {
  id: string;
  inquiry: Inquiry;
  name: string;
  task: string;
  rate: number;
  next?: string;
}

const STAGE_TONE = {
  inquiry: "info",
  screening: "warning",
  interview: "purple",
  trial: "warning",
  connected: "success",
  declined: "neutral",
} as const;

/** The same pipeline as a sortable table, for scanning many bidders at once. */
export function PipelineList({
  inquiries,
  onOpen,
}: {
  inquiries: Inquiry[];
  onOpen: (inquiryId: string) => void;
}) {
  const { bidderById, taskById, interviews } = useHunter();
  const rows: Row[] = inquiries.map((inquiry) => {
    const next = interviews
      .filter((item) => item.inquiryId === inquiry.id && isUpcoming(item))
      .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))[0];
    return {
      id: inquiry.id,
      inquiry,
      name: bidderById(inquiry.bidderId)?.name ?? "Bidder",
      task: taskById(inquiry.taskId)?.title ?? "",
      rate: Math.min(...inquiry.proposedRates.map((offer) => offer.rate)),
      next: next
        ? `${shortDate(`${next.date}T00:00:00Z`)} · ${displayClock(next.start)}`
        : undefined,
    };
  });

  return (
    <Table<Row>
      caption="Bidder pipeline"
      rows={rows}
      rowKey={(row) => row.id}
      onRowClick={(row) => onOpen(row.id)}
      pageSize={10}
      columns={[
        {
          key: "name",
          header: "Bidder",
          sortable: true,
          render: (row) => (
            <Person name={row.name} detail={bidderById(row.inquiry.bidderId)?.level} />
          ),
        },
        {
          key: "task",
          header: "Task",
          sortable: true,
          render: (row) => <span className="hx-truncate">{row.task}</span>,
        },
        {
          key: "stage",
          header: "Stage",
          sortable: true,
          sortValue: (row) => STAGE_TITLE[row.inquiry.stage],
          render: (row) => (
            <Badge label={STAGE_TITLE[row.inquiry.stage]} tone={STAGE_TONE[row.inquiry.stage]} />
          ),
        },
        {
          key: "rate",
          header: "Proposed rate",
          align: "end",
          sortable: true,
          render: (row) => <span className="hx-num">{money(row.rate)}</span>,
        },
        {
          key: "score",
          header: "Your score",
          align: "end",
          sortable: true,
          sortValue: (row) => row.inquiry.score ?? 0,
          render: (row) => (
            <span className="hx-num">{row.inquiry.score ? `${row.inquiry.score}/5` : "—"}</span>
          ),
        },
        { key: "next", header: "Next interview", render: (row) => <span>{row.next ?? "—"}</span> },
        {
          key: "createdAt",
          header: "Contacted",
          sortable: true,
          sortValue: (row) => row.inquiry.createdAt,
          render: (row) => <span>{relativeTime(row.inquiry.createdAt)}</span>,
        },
      ]}
    />
  );
}
