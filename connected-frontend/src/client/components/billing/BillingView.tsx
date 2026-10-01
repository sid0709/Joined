"use client";

import { Table } from "@joined/design-system";
import { useState } from "react";

import { InvoiceDetail } from "@/src/client/components/billing/InvoiceDetail";
import { SpendBreakdowns, TransactionsPanel } from "@/src/client/components/billing/SpendPanels";
import { TopUpDialog } from "@/src/client/components/billing/TopUpDialog";
import { useHunter } from "@/src/client/context/HunterContext";
import { PageHeader } from "@/src/shared/kit/PageHeader";
import { Panel } from "@/src/shared/kit/Panel";
import { StatCard } from "@/src/shared/kit/StatCard";
import { InvoiceStatusBadge } from "@/src/shared/kit/StatusBadge";
import { longDate, money } from "@/src/shared/lib/format";
import { invoiceTotals } from "@/src/shared/lib/selectors";
import { Banner, Button, PageBody } from "@/src/shared/marketplace-ui";

interface Row extends Record<string, unknown> {
  id: string;
  number: string;
  period: string;
  links: number;
  amount: number;
  dueAt: string;
  status: "open" | "paid" | "overdue";
}

export function BillingView() {
  const { profile, invoices, invoiceLines, transactions, payInvoice, topUp } = useHunter();
  const [selectedId, setSelectedId] = useState(invoices[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);

  const rows: Row[] = invoices.map((invoice) => {
    const totals = invoiceTotals(invoice, invoiceLines);
    return {
      id: invoice.id,
      number: invoice.number,
      period: invoice.period,
      links: totals.links,
      amount: totals.amount,
      dueAt: invoice.dueAt,
      status: invoice.status,
    };
  });
  const selected = invoices.find((invoice) => invoice.id === selectedId) ?? invoices[0];
  const unpaid = rows.filter((row) => row.status !== "paid");
  const outstanding = unpaid.reduce((sum, row) => sum + row.amount, 0);
  const paid = rows.filter((row) => row.status === "paid");
  const paidTotal = paid.reduce((sum, row) => sum + row.amount, 0);
  const paidLinks = paid.reduce((sum, row) => sum + row.links, 0);
  const overdue = rows.filter((row) => row.status === "overdue");
  const refunds = transactions
    .filter((txn) => txn.kind === "refund")
    .reduce((sum, txn) => sum + txn.amount, 0);

  const pay = (invoiceId: string) => {
    const result = payInvoice(invoiceId);
    setError(result.ok ? null : (result.error ?? null));
    setNotice(result.ok ? "Invoice paid. Bidders are credited for every QA-passed link." : null);
  };

  return (
    <PageBody>
      <div className="hx-page">
        <PageHeader
          eyebrow="Billing"
          title="Pay bidders for QA-passed links"
          description="Invoices are generated weekly from the links that passed your QA at each package's agreed rate. Keep your wallet funded and pay when you are ready."
          actions={
            <Button variant="primary" label="Add funds" onClick={() => setTopUpOpen(true)} />
          }
        />

        {overdue.length > 0 && (
          <Banner
            tone="danger"
            title={`${overdue.length} invoice overdue`}
            description={`${money(overdue.reduce((sum, row) => sum + row.amount, 0))} is past due. Pay it to avoid pausing your tasks.`}
          />
        )}
        {error && <Banner tone="danger" title={error} />}
        {notice && <Banner tone="success" title={notice} />}

        <div className="hx-grid hx-grid-stats">
          <StatCard
            label="Wallet balance"
            value={money(profile.balance)}
            icon="download"
            footnote={
              profile.balance >= outstanding
                ? "Covers what is due"
                : `${money(outstanding - profile.balance)} short of what is due`
            }
            tone={profile.balance >= outstanding ? "success" : "warning"}
          />
          <StatCard
            label="Outstanding"
            value={money(outstanding)}
            icon="clock"
            tone={overdue.length ? "danger" : "warning"}
            footnote={`${unpaid.length} unpaid invoices`}
          />
          <StatCard
            label="Paid to bidders"
            value={money(paidTotal)}
            icon="check"
            tone="success"
            footnote={`${paidLinks} links across ${paid.length} invoices`}
          />
          <StatCard
            label="Average per link"
            value={paidLinks ? money(paidTotal / paidLinks) : "—"}
            icon="star"
            footnote={refunds ? `${money(refunds)} refunded` : "No refunds"}
          />
        </div>

        <div className="hx-split hx-split-even">
          <div className="hx-stack">
            <Panel title="Invoices" subtitle="Select an invoice to see what it pays for" flush>
              <Table<Row>
                variant="plain"
                caption="Invoices"
                rows={rows}
                rowKey={(row) => row.id}
                onRowClick={(row) => setSelectedId(row.id)}
                columns={[
                  {
                    key: "number",
                    header: "Invoice",
                    render: (row) => (
                      <div className="hx-list-body">
                        <span className="hx-list-title">{row.number}</span>
                        <span className="hx-list-meta">{row.period}</span>
                      </div>
                    ),
                  },
                  {
                    key: "links",
                    header: "Links",
                    align: "end",
                    render: (row) => <span className="hx-num">{row.links}</span>,
                  },
                  {
                    key: "amount",
                    header: "Amount",
                    align: "end",
                    sortable: true,
                    render: (row) => <strong className="hx-num">{money(row.amount)}</strong>,
                  },
                  {
                    key: "dueAt",
                    header: "Due",
                    render: (row) => <span>{longDate(row.dueAt)}</span>,
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (row) => <InvoiceStatusBadge status={row.status} />,
                  },
                  {
                    key: "action",
                    header: "",
                    align: "end",
                    render: (row) =>
                      row.status !== "paid" ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          label="Pay"
                          onClick={() => pay(row.id)}
                        />
                      ) : null,
                  },
                ]}
              />
            </Panel>
            {selected && (
              <InvoiceDetail
                invoice={selected}
                lines={invoiceLines.filter((line) => line.invoiceId === selected.id)}
                onPay={() => pay(selected.id)}
              />
            )}
          </div>
          <div className="hx-stack">
            <SpendBreakdowns />
            <TransactionsPanel />
          </div>
        </div>

        <TopUpDialog
          open={topUpOpen}
          onClose={() => setTopUpOpen(false)}
          onConfirm={(amount) => {
            topUp(amount);
            setNotice(`${money(amount)} added to your wallet.`);
            setError(null);
          }}
        />
      </div>
    </PageBody>
  );
}
