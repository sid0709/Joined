"use client";

import { Badge, Table, type BadgeVariant, type TableColumn } from "@openseat/design-system";
import { APPLICATIONS, type ApplicationRow, type ApplicationStatus } from "@/lib/account";

const STATUS_VARIANT: Record<ApplicationStatus, BadgeVariant> = {
  Saved: "neutral",
  Applied: "info",
  Viewed: "blue",
  Interview: "warning",
  Offer: "success",
  Rejected: "error",
  "No response": "neutral",
};

const COLUMNS: TableColumn<ApplicationRow>[] = [
  { key: "title", header: "Job" },
  { key: "company", header: "Company" },
  {
    key: "status",
    header: "Status",
    render: (row) => <Badge label={row.status} variant={STATUS_VARIANT[row.status]} />,
  },
  { key: "updated", header: "Updated" },
];

export function ApplicationsTable() {
  return <Table caption="Applications" columns={COLUMNS} rows={APPLICATIONS} rowKey={(row) => row.id} />;
}
