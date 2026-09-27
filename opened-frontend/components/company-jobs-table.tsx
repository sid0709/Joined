"use client";

import { Badge, Table, type BadgeVariant, type TableColumn } from "@openseat/design-system";
import { COMPANY_JOBS, type CompanyJob, type CompanyJobStatus } from "@/lib/account";

const STATUS_VARIANT: Record<CompanyJobStatus, BadgeVariant> = {
  Open: "success",
  Paused: "warning",
  Closed: "neutral",
};

const COLUMNS: TableColumn<CompanyJob>[] = [
  { key: "title", header: "Job" },
  { key: "location", header: "Location" },
  { key: "applicants", header: "Applicants", align: "end" },
  { key: "policy", header: "Assisted applications" },
  {
    key: "status",
    header: "Status",
    render: (row) => <Badge label={row.status} variant={STATUS_VARIANT[row.status]} />,
  },
];

export function CompanyJobsTable() {
  return <Table caption="Company jobs" columns={COLUMNS} rows={COMPANY_JOBS} rowKey={(row) => row.id} />;
}
