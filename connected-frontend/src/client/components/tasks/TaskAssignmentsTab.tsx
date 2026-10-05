import { Table } from "sid-ui";

import type { ApplicationRecord, Assignment } from "@/src/shared/types/marketplace";

import { useHunter } from "@/src/client/context/HunterContext";
import { EmptyBlock } from "@/src/shared/kit/EmptyBlock";
import { Meter } from "@/src/shared/kit/Meter";
import { Panel } from "@/src/shared/kit/Panel";
import { relativeTime, shortDate } from "@/src/shared/lib/format";
import { countStatuses } from "@/src/shared/lib/selectors";
import { Badge } from "@/src/shared/marketplace-ui";
import { PACKAGE_BY_ID } from "@/src/shared/mock/packages";

interface Row extends Record<string, unknown> {
  id: string;
  bidder: string;
  packageName: string;
  links: number;
  passed: number;
  submitted: number;
  bad: number;
  assignedAt: string;
  dueAt: string;
  status: Assignment["status"];
}

export function TaskAssignmentsTab({
  assignments,
  applications,
}: {
  assignments: Assignment[];
  applications: ApplicationRecord[];
}) {
  const { bidderById } = useHunter();
  if (!assignments.length) {
    return (
      <EmptyBlock
        icon="link"
        title="Nothing assigned yet"
        description="Assign links from the job pool to one of this task's connected bidders."
      />
    );
  }
  const rows: Row[] = assignments.map((assignment) => {
    const counts = countStatuses(
      applications.filter((application) => application.assignmentId === assignment.id),
    );
    return {
      id: assignment.id,
      bidder: bidderById(assignment.bidderId)?.name ?? "Bidder",
      packageName: PACKAGE_BY_ID.get(assignment.packageId)?.name ?? "",
      links: assignment.jobIds.length,
      passed: counts.qa_passed,
      submitted: counts.submitted,
      bad: counts.returned + counts.failed,
      assignedAt: assignment.assignedAt,
      dueAt: assignment.dueAt,
      status: assignment.status,
    };
  });

  return (
    <Panel
      title="Assignments"
      subtitle="Each assignment is a set of pool links handed to one bidder under one package"
      flush
    >
      <Table<Row>
        variant="plain"
        caption="Assignments for this task"
        rows={rows}
        rowKey={(row) => row.id}
        columns={[
          {
            key: "bidder",
            header: "Bidder",
            sortable: true,
            render: (row) => (
              <div className="hx-list-body">
                <span className="hx-list-title">{row.bidder}</span>
                <span className="hx-list-meta">{row.packageName}</span>
              </div>
            ),
          },
          {
            key: "links",
            header: "Links",
            align: "end",
            sortable: true,
            render: (row) => <span className="hx-num">{row.links}</span>,
          },
          {
            key: "progress",
            header: "Progress",
            width: "16rem",
            render: (row) => (
              <Meter
                label={row.bidder}
                total={row.links}
                segments={[
                  { label: "QA passed", value: row.passed, tone: "positive" },
                  { label: "Awaiting QA", value: row.submitted, tone: "soft" },
                  { label: "Returned or failed", value: row.bad, tone: "critical" },
                ]}
              />
            ),
          },
          {
            key: "assignedAt",
            header: "Assigned",
            sortable: true,
            render: (row) => <span>{shortDate(row.assignedAt)}</span>,
          },
          { key: "dueAt", header: "Due", render: (row) => <span>{relativeTime(row.dueAt)}</span> },
          {
            key: "status",
            header: "Status",
            render: (row) => (
              <Badge
                label={
                  row.status === "active"
                    ? "Active"
                    : row.status === "completed"
                      ? "Completed"
                      : "Paused"
                }
                tone={
                  row.status === "active"
                    ? "info"
                    : row.status === "completed"
                      ? "success"
                      : "warning"
                }
              />
            ),
          },
        ]}
      />
    </Panel>
  );
}
