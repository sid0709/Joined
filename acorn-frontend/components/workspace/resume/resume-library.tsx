"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Glyph,
  HStack,
  SegmentedControl,
  SegmentedControlItem,
  Stack,
  Table,
  Text,
  type TableColumn,
} from "@joined/design-system";
import { formatWhen, type LibraryResume } from "@/lib/workspace/model";

type Filter = "all" | LibraryResume["source"];

/** Uploads from Profile and kept drafts, filterable by where they came from. */
export function ResumeLibrary({
  items,
  selectedId,
  canView,
  onView,
}: {
  items: LibraryResume[];
  selectedId: string | null;
  canView: (id: string) => boolean;
  onView: (id: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const rows = filter === "all" ? items : items.filter((item) => item.source === filter);
  const uploads = items.filter((item) => item.source === "upload").length;

  const columns: TableColumn<LibraryResume>[] = [
    {
      key: "name",
      header: "File",
      sortable: true,
      render: (item) => (
        <HStack gap={2} vAlign="center">
          <Glyph name={item.source === "upload" ? "upload" : "sparkle"} />
          <Stack gap={0}>
            <Text weight="semibold">{item.name}</Text>
            <Text type="supporting" color="secondary">
              {item.detail}
            </Text>
          </Stack>
        </HStack>
      ),
    },
    {
      key: "source",
      header: "Source",
      sortable: true,
      render: (item) => (
        <Badge
          label={item.source === "upload" ? "Upload" : "Generated"}
          variant={item.source === "upload" ? "neutral" : "blue"}
        />
      ),
    },
    {
      key: "addedAt",
      header: "Added",
      sortable: true,
      render: (item) => <Text color="secondary">{formatWhen(item.addedAt)}</Text>,
    },
    {
      key: "action",
      header: "",
      align: "end",
      render: (item) =>
        canView(item.id) ? (
          <Button
            label={item.id === selectedId ? "Showing" : "Preview"}
            variant={item.id === selectedId ? "primary" : "secondary"}
            size="sm"
            onClick={() => onView(item.id)}
          />
        ) : null,
    },
  ];

  return (
    <Stack gap={4}>
      <SegmentedControl
        label="Library filter"
        size="sm"
        value={filter}
        onChange={(value) => setFilter(value as Filter)}
      >
        <SegmentedControlItem value="all" label={`All · ${items.length}`} />
        <SegmentedControlItem value="generated" label={`Generated · ${items.length - uploads}`} />
        <SegmentedControlItem value="upload" label={`Uploads · ${uploads}`} />
      </SegmentedControl>
      <Table
        caption="Resume library"
        variant="plain"
        columns={columns}
        rows={rows}
        rowKey={(item) => item.id}
        defaultSort={{ key: "addedAt", direction: "desc" }}
        empty="No files here yet. Upload a résumé on Profile or generate a draft."
      />
    </Stack>
  );
}
