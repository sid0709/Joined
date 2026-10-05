"use client";

import { Badge, Table, Text, type TableColumn } from "sid-ui";
import { formatPrice, type Invoice } from "@/lib/billing";
import { formatDay } from "@/lib/workspace/dates";

/** Charges, newest first, with the next one on top. */
export function InvoiceTable({ invoices }: { invoices: Invoice[] }) {
  const columns: TableColumn<Invoice>[] = [
    {
      key: "on",
      header: "Date",
      render: (invoice) => <Text>{formatDay(invoice.on)}</Text>,
    },
    { key: "description", header: "Description" },
    {
      key: "amount",
      header: "Amount",
      align: "end",
      render: (invoice) => <Text>{`${formatPrice(invoice.amount)}.00`}</Text>,
    },
    {
      key: "status",
      header: "Status",
      align: "end",
      render: (invoice) =>
        invoice.status === "paid" ? (
          <Badge label="Paid" variant="success" />
        ) : (
          <Badge label="Upcoming" variant="neutral" />
        ),
    },
  ];
  return (
    <Table
      caption="Invoices"
      variant="plain"
      columns={columns}
      rows={invoices}
      rowKey={(invoice) => invoice.id}
    />
  );
}
