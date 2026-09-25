"use client";

import { useState } from "react";
import { Card, HStack, Heading, Icon, MoreMenu, Stack, Table, Text, icons, type DropdownMenuOption, type TableColumn } from "@openseat/design-system";
import { Caption, Examples, Preview, Row } from "./shared";

type Room = { id: string; name: string; bids: number };

const ROOMS: Room[] = [
  { id: "brand", name: "Brand refresh", bids: 6 },
  { id: "landing", name: "Landing page", bids: 2 },
  { id: "motion", name: "Motion system", bids: 0 },
];

export default function MoreMenuDemo() {
  const [last, setLast] = useState<string | null>(null);
  const run = (label: string) => () => setLast(label);

  const roomActions = (name: string): DropdownMenuOption[] => [
    { label: "Open", icon: icons.eye, onClick: run(`Open ${name}`) },
    { label: "Rename", icon: icons.edit, onClick: run(`Rename ${name}`) },
    { label: "Duplicate", icon: icons.file, onClick: run(`Duplicate ${name}`) },
    { type: "divider" },
    { label: "Delete", icon: icons.trash, variant: "destructive", onClick: run(`Delete ${name}`) },
  ];

  const columns: TableColumn<Room>[] = [
    { key: "name", header: "Room" },
    { key: "bids", header: "Bids", align: "end" },
    {
      key: "actions",
      header: "",
      align: "end",
      width: 48,
      render: (row) => <MoreMenu label={`Actions for ${row.name}`} variant="ghost" size="sm" items={roomActions(row.name)} />,
    },
  ];

  return (
    <Examples>
      <Preview align="start" label="Default" description="The overflow trigger — three dots, never a labeled button.">
        <Stack gap={2} hAlign="start">
          <Row>
            <MoreMenu items={roomActions("room")} />
            <MoreMenu variant="ghost" items={roomActions("room")} />
            <MoreMenu variant="primary" items={roomActions("room")} />
          </Row>
          <Caption>{last ? `Last action: ${last}` : "Open a menu and pick an action."}</Caption>
        </Stack>
      </Preview>

      <Preview align="start" label="Sizes">
        <Row>
          <MoreMenu size="sm" variant="ghost" items={roomActions("small")} />
          <MoreMenu size="md" variant="ghost" items={roomActions("medium")} />
          <MoreMenu size="lg" variant="ghost" items={roomActions("large")} />
        </Row>
      </Preview>

      <Preview align="start" label="Custom icon">
        <Row>
          <MoreMenu label="Settings" icon={<Icon icon={icons.settings} />} variant="ghost" items={[{ label: "Preferences" }, { label: "Keyboard shortcuts" }]} />
          <MoreMenu label="Share" icon={<Icon icon={icons.share} />} variant="ghost" items={[{ label: "Copy link", icon: icons.link }, { label: "Email", icon: icons.mail }]} />
        </Row>
      </Preview>

      <Preview align="start" label="Sections">
        <MoreMenu
          label="Document actions"
          items={[
            {
              type: "section",
              title: "Actions",
              items: [
                { label: "Edit", icon: icons.edit, onClick: run("Edit") },
                { label: "Duplicate", icon: icons.file, onClick: run("Duplicate") },
              ],
            },
            {
              type: "section",
              title: "Danger zone",
              items: [{ label: "Delete", icon: icons.trash, variant: "destructive", onClick: run("Delete") }],
            },
          ]}
        />
      </Preview>

      <Preview label="Pattern — card header">
        <Card>
          <HStack hAlign="between" vAlign="center">
            <Stack gap={0.5} hAlign="start">
              <Heading level={4}>Quarterly plan</Heading>
              <Text type="supporting" color="secondary">
                Updated a few minutes ago
              </Text>
            </Stack>
            <MoreMenu label="Plan actions" variant="ghost" items={roomActions("plan")} />
          </HStack>
        </Card>
      </Preview>

      <Preview label="Pattern — table row actions">
        <Table columns={columns} rows={ROOMS} rowKey={(row) => row.id} />
      </Preview>

      <Preview align="start" label="Disabled and bottom sheet">
        <Row>
          <MoreMenu isDisabled items={roomActions("disabled")} />
          <MoreMenu
            label="Project actions"
            presentation="bottom-sheet"
            items={[
              { label: "Rename project", description: "Update the project title.", icon: icons.edit, onClick: run("Rename project") },
              { label: "Share project", description: "Invite collaborators.", icon: icons.share, onClick: run("Share project") },
            ]}
          />
        </Row>
      </Preview>
    </Examples>
  );
}
