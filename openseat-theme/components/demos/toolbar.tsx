"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  ButtonGroup,
  Card,
  DropdownMenu,
  Heading,
  Icon,
  IconButton,
  MoreMenu,
  SegmentedControl,
  SegmentedControlItem,
  Stack,
  Table,
  Text,
  TextInput,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  icons,
  type TableColumn,
  type ToolbarSize,
} from "@openseat/design-system";
import { Caption, Examples, Preview, Row } from "./shared";

const SIZES: ToolbarSize[] = ["sm", "md", "lg"];

type Person = { id: string; name: string; role: string; status: string };

const PEOPLE: Person[] = [
  { id: "1", name: "Alex Johnson", role: "Admin", status: "Active" },
  { id: "2", name: "Sam Rivera", role: "Editor", status: "Active" },
  { id: "3", name: "Jordan Lee", role: "Viewer", status: "Invited" },
  { id: "4", name: "Taylor Kim", role: "Editor", status: "Active" },
];

const COLUMNS: TableColumn<Person>[] = [
  { key: "name", header: "Name", sortable: true },
  { key: "role", header: "Role", sortable: true },
  { key: "status", header: "Status", render: (row) => <Badge label={row.status} variant={row.status === "Active" ? "success" : "neutral"} /> },
];

export default function ToolbarDemo() {
  const [format, setFormat] = useState<string[]>(["bold"]);
  const [align, setAlign] = useState<string | null>("left");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("All");
  const [selected, setSelected] = useState<string[]>(["2"]);
  const [view, setView] = useState("table");

  const people = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PEOPLE.filter((p) => (role === "All" || p.role === role) && (!q || p.name.toLowerCase().includes(q)));
  }, [query, role]);

  return (
    <Examples>
      <Preview label="Editor formatting" description="Groups of related controls, separated by the toolbar's rhythm.">
        <Card>
          <Toolbar
            label="Formatting"
            size="sm"
            startContent={
              <Row>
                <ButtonGroup label="History" size="sm">
                  <IconButton label="Undo" icon={<Icon icon={icons.undo} />} />
                  <IconButton label="Redo" icon={<Icon icon={icons.redo} />} />
                </ButtonGroup>
                <ToggleButtonGroup type="multiple" label="Text style" size="sm" value={format} onChange={setFormat}>
                  <ToggleButton value="bold" label="Bold" isIconOnly icon={<Icon icon={icons.bold} />} />
                  <ToggleButton value="italic" label="Italic" isIconOnly icon={<Icon icon={icons.italic} />} />
                  <ToggleButton value="underline" label="Underline" isIconOnly icon={<Icon icon={icons.underline} />} />
                </ToggleButtonGroup>
                <ToggleButtonGroup label="Alignment" size="sm" value={align} onChange={setAlign}>
                  <ToggleButton value="left" label="Left" isIconOnly icon={<Icon icon={icons.alignLeft} />} />
                  <ToggleButton value="center" label="Center" isIconOnly icon={<Icon icon={icons.alignCenter} />} />
                  <ToggleButton value="right" label="Right" isIconOnly icon={<Icon icon={icons.alignRight} />} />
                </ToggleButtonGroup>
              </Row>
            }
            endContent={
              <Row>
                <IconButton label="Insert link" variant="ghost" icon={<Icon icon={icons.link} />} />
                <IconButton label="Insert image" variant="ghost" icon={<Icon icon={icons.image} />} />
                <IconButton label="Code" variant="ghost" icon={<Icon icon={icons.code} />} />
              </Row>
            }
          />
        </Card>
      </Preview>

      <Preview label="Three slots — page header">
        <Card>
          <Toolbar
            label="Document toolbar"
            startContent={<IconButton label="Back" variant="ghost" icon={<Icon icon={icons.chevronLeft} />} />}
            centerContent={<Heading level={4}>Brand refresh brief</Heading>}
            endContent={
              <Row>
                <Button label="Discard" variant="ghost" />
                <Button label="Save" variant="primary" />
              </Row>
            }
          />
        </Card>
      </Preview>

      <Preview label="Data table toolbar" description="Search, filter, view, and bulk actions over a Table.">
        <Stack gap={3}>
          <Toolbar
            label="People toolbar"
            startContent={
              <Row>
                <Stack width={220}>
                  <TextInput
                    size="sm"
                    label="Search people"
                    isLabelHidden
                    placeholder="Search people"
                    value={query}
                    onChange={setQuery}
                    startIcon={<Icon icon={icons.search} />}
                    hasClear
                  />
                </Stack>
                <DropdownMenu
                  button={{ label: `Role: ${role}`, size: "sm", icon: <Icon icon={icons.filter} /> }}
                  items={["All", "Admin", "Editor", "Viewer"].map((r) => ({ label: r, onClick: () => setRole(r) }))}
                />
              </Row>
            }
            endContent={
              <Row>
                <SegmentedControl label="View" size="sm" value={view} onChange={setView}>
                  <SegmentedControlItem value="table" label="Table" isLabelHidden icon={<Icon icon={icons.list} />} />
                  <SegmentedControlItem value="grid" label="Grid" isLabelHidden icon={<Icon icon={icons.grid} />} />
                </SegmentedControl>
                <Button label="Invite" variant="primary" size="sm" icon={<Icon icon={icons.plus} />} />
              </Row>
            }
          />
          <Table columns={COLUMNS} rows={people} rowKey={(row) => row.id} selection="multiple" selectedKeys={selected} onSelectionChange={setSelected} />
          {selected.length > 0 && (
            <Toolbar
              label="Bulk actions"
              size="sm"
              variant="muted"
              startContent={<Text weight="medium">{selected.length} selected</Text>}
              endContent={
                <Row>
                  <Button label="Change role" size="sm" />
                  <Button label="Remove" size="sm" variant="destructive" />
                  <IconButton label="Clear selection" size="sm" variant="ghost" icon={<Icon icon={icons.close} />} onClick={() => setSelected([])} />
                </Row>
              }
            />
          )}
        </Stack>
      </Preview>

      <Preview label="Sizes" description="Children inherit the toolbar size as their default.">
        <Stack gap={3}>
          {SIZES.map((size) => (
            <Card key={size}>
              <Toolbar
                label={`${size} toolbar`}
                size={size}
                startContent={<Heading level={4}>{size.toUpperCase()}</Heading>}
                endContent={
                  <Row>
                    <IconButton label="Filter" variant="ghost" icon={<Icon icon={icons.filter} />} />
                    <MoreMenu variant="ghost" items={[{ label: "Export" }, { label: "Print" }]} />
                    <Button label="Add" variant="primary" icon={<Icon icon={icons.plus} />} />
                  </Row>
                }
              />
            </Card>
          ))}
        </Stack>
      </Preview>

      <Preview label="Vertical rail">
        <Row>
          <Toolbar
          label="Tools"
          orientation="vertical"
          variant="muted"
          startContent={
            <Stack gap={1}>
              <IconButton label="Select" variant="ghost" icon={<Icon icon={icons.arrowUp} />} />
              <IconButton label="Draw" variant="ghost" icon={<Icon icon={icons.edit} />} />
              <IconButton label="Image" variant="ghost" icon={<Icon icon={icons.image} />} />
              <IconButton label="Comment" variant="ghost" icon={<Icon icon={icons.mail} />} />
            </Stack>
          }
          endContent={<IconButton label="Settings" variant="ghost" icon={<Icon icon={icons.settings} />} />}
          />
        </Row>
      </Preview>

      <Preview label="Dividers">
        <Card>
          <Stack gap={0}>
            <Toolbar label="Top bar" dividers={["bottom"]} startContent={<Heading level={4}>Messages</Heading>} endContent={<IconButton label="New message" variant="ghost" icon={<Icon icon={icons.edit} />} />} />
            <Caption>Body content sits between toolbars.</Caption>
            <Toolbar label="Bottom bar" dividers={["top"]} endContent={<Button label="Send" variant="primary" size="sm" icon={<Icon icon={icons.send} />} />} />
          </Stack>
        </Card>
      </Preview>
    </Examples>
  );
}
