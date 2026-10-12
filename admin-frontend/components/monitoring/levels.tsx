import { Badge, SectionCard, Table, Text, type TableColumn } from "sid-ui";
import type { ServiceLevel } from "@/lib/monitoring";

const columns: TableColumn<ServiceLevel>[] = [
  { key: "name", header: "Target", render: (row) => <Text weight="semibold">{row.name}</Text> },
  { key: "target", header: "Goal", render: (row) => row.target },
  { key: "now", header: "Now", align: "end", render: (row) => row.now },
  {
    key: "met",
    header: "Status",
    align: "end",
    render: (row) =>
      row.now === "—" ? (
        <Badge label="No data" variant="neutral" />
      ) : (
        <Badge label={row.met ? "Met" : "Missed"} variant={row.met ? "success" : "error"} />
      ),
  },
];

/** Named targets for the selected range, plus the live host gauges. */
export function ServiceLevels({ levels }: { levels: ServiceLevel[] }) {
  return (
    <SectionCard
      title="Service levels"
      description="Targets for the selected range, except the host gauges, which are right now."
    >
      <Table
        columns={columns}
        rows={levels}
        rowKey={(row) => row.name}
        variant="plain"
        density="compact"
        empty="No targets yet."
      />
    </SectionCard>
  );
}
