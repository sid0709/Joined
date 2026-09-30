import { Table } from "@openseat/design-system";

import type { Invoice, InvoiceLine } from "@/src/shared/types/marketplace";

import { useHunter } from "@/src/client/context/HunterContext";
import { Panel } from "@/src/shared/kit/Panel";
import { InvoiceStatusBadge } from "@/src/shared/kit/StatusBadge";
import { longDate, money } from "@/src/shared/lib/format";
import { lineAmount, sumLines } from "@/src/shared/lib/selectors";
import { Button } from "@/src/shared/marketplace-ui";
import { PACKAGE_BY_ID } from "@/src/shared/mock/packages";

interface Row extends Record<string, unknown> {
  id: string;
  bidder: string;
  task: string;
  packageName: string;
  links: number;
  rate: number;
  amount: number;
}

interface InvoiceDetailProps {
  invoice: Invoice;
  lines: InvoiceLine[];
  onPay: () => void;
}

/** What one invoice pays for: bidder, package, links, rate. */
export function InvoiceDetail({ invoice, lines, onPay }: InvoiceDetailProps) {
  const { bidderById, taskById } = useHunter();
  const rows: Row[] = lines.map((line) => ({
    id: line.id,
    bidder: bidderById(line.bidderId)?.name ?? "Bidder",
    task: taskById(line.taskId)?.title ?? "",
    packageName: PACKAGE_BY_ID.get(line.packageId)?.name ?? "",
    links: line.links,
    rate: line.rate,
    amount: lineAmount(line),
  }));
  const total = sumLines(lines);

  return (
    <Panel
      title={invoice.number}
      subtitle={`${invoice.period} · due ${longDate(invoice.dueAt)}`}
      actions={
        <>
          <InvoiceStatusBadge status={invoice.status} />
          {invoice.status !== "paid" && (
            <Button variant="primary" label={`Pay ${money(total)}`} onClick={onPay} />
          )}
        </>
      }
      flush
    >
      <Table<Row>
        variant="plain"
        caption={`${invoice.number} line items`}
        rows={rows}
        rowKey={(row) => row.id}
        columns={[
          {
            key: "bidder",
            header: "Bidder",
            render: (row) => (
              <div className="hx-list-body">
                <span className="hx-list-title">{row.bidder}</span>
                <span className="hx-list-meta hx-truncate">{row.task}</span>
              </div>
            ),
          },
          { key: "packageName", header: "Package" },
          {
            key: "links",
            header: "QA-passed links",
            align: "end",
            render: (row) => <span className="hx-num">{row.links}</span>,
          },
          {
            key: "rate",
            header: "Rate",
            align: "end",
            render: (row) => <span className="hx-num">{money(row.rate)}</span>,
          },
          {
            key: "amount",
            header: "Amount",
            align: "end",
            render: (row) => <strong className="hx-num">{money(row.amount)}</strong>,
          },
        ]}
      />
      <div
        className="hx-panel-head"
        style={{
          borderTop: "var(--border-width-hairline) solid var(--color-border)",
          borderBottom: 0,
        }}
      >
        <span className="hx-muted">
          {invoice.paidAt ? `Paid ${longDate(invoice.paidAt)}` : "Total due"}
        </span>
        <strong className="hx-num" style={{ fontSize: "var(--font-size-xl)" }}>
          {money(total)}
        </strong>
      </div>
    </Panel>
  );
}
