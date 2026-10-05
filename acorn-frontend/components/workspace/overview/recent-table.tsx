"use client";

import { Avatar, Badge, HStack, Stack, Table, Text, type TableColumn } from "sid-ui";
import { STAGE_BADGE, type Application } from "@/lib/workspace/applications";
import { formatDay, type Day } from "@/lib/workspace/dates";
import { STATUS_LABEL, lastEvent, statusOf } from "@/lib/workspace/stats";

const PAGE_SIZE = 6;

export function RecentTable({ applications, today }: { applications: Application[]; today: Day }) {
  const columns: TableColumn<Application>[] = [
    {
      key: "company",
      header: "Company",
      sortable: true,
      render: (app) => (
        <HStack gap={3} vAlign="center">
          <Avatar name={app.company} size="sm" shape="rounded" />
          <Stack gap={0}>
            <Text weight="semibold">{app.company}</Text>
            <Text type="supporting" color="secondary">
              {app.role}
            </Text>
          </Stack>
        </HStack>
      ),
    },
    { key: "source", header: "Source", sortable: true },
    { key: "workMode", header: "Mode", sortable: true },
    {
      key: "stage",
      header: "Status",
      sortable: true,
      sortValue: (app) => statusOf(app),
      render: (app) => {
        const status = statusOf(app);
        return <Badge label={STATUS_LABEL[status]} variant={STAGE_BADGE[status]} />;
      },
    },
    {
      key: "updated",
      header: "Updated",
      align: "end",
      sortable: true,
      sortValue: (app) => lastEvent(app, today),
      render: (app) => <Text color="secondary">{formatDay(lastEvent(app, today))}</Text>,
    },
  ];

  return (
    <Table
      caption="Recent applications"
      variant="plain"
      columns={columns}
      rows={applications}
      rowKey={(app) => app.id}
      pageSize={PAGE_SIZE}
      defaultSort={{ key: "updated", direction: "desc" }}
    />
  );
}
