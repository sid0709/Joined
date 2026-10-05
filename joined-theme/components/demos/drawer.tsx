"use client";

import {
  Avatar,
  Badge,
  Button,
  CheckboxList,
  CheckboxListItem,
  Drawer,
  FormLayout,
  HStack,
  Icon,
  IconButton,
  List,
  ListItem,
  MetadataList,
  MetadataListItem,
  MoreMenu,
  RadioList,
  RadioListItem,
  Selector,
  SideNav,
  SideNavItem,
  Slider,
  Stack,
  Tab,
  TabList,
  Table,
  Text,
  TextArea,
  TextInput,
  Timeline,
  icons,
  type DrawerSide,
  type DrawerSize,
  type TableColumn,
} from "sid-ui";
import { useState } from "react";

import { Caption, Examples, PEOPLE, Preview, Row } from "./shared";

const SIDES: DrawerSide[] = ["start", "end", "top", "bottom"];
const SIZES: DrawerSize[] = ["sm", "md", "lg", "full"];
const BUDGET_MAX = 10000;
const BUDGET_STEP = 250;

type Room = {
  id: string;
  title: string;
  owner: string;
  budget: number;
  status: "Open" | "Review" | "Awarded";
  bids: number;
};
const ROOMS: Room[] = [
  {
    id: "brand",
    title: "Brand refresh",
    owner: PEOPLE[0].name,
    budget: 2400,
    status: "Open",
    bids: 6,
  },
  {
    id: "landing",
    title: "Landing page copy",
    owner: PEOPLE[1].name,
    budget: 1800,
    status: "Review",
    bids: 2,
  },
  {
    id: "motion",
    title: "Motion system",
    owner: PEOPLE[2].name,
    budget: 3200,
    status: "Open",
    bids: 4,
  },
  {
    id: "deck",
    title: "Pitch deck",
    owner: PEOPLE[3].name,
    budget: 950,
    status: "Awarded",
    bids: 11,
  },
];
const STATUS_VARIANT = { Open: "success", Review: "warning", Awarded: "info" } as const;
const usd = (v: number) => `$${v.toLocaleString()}`;
const COLUMNS: TableColumn<Room>[] = [
  { key: "title", header: "Room" },
  { key: "owner", header: "Owner" },
  {
    key: "status",
    header: "Status",
    render: (r) => <Badge label={r.status} variant={STATUS_VARIANT[r.status]} />,
  },
  { key: "budget", header: "Budget", align: "end", render: (r) => usd(r.budget) },
];
const NOTIFICATIONS = [
  { who: PEOPLE[0].name, what: "submitted a bid on Brand refresh", when: "2m" },
  { who: PEOPLE[1].name, what: "asked a question on Landing page copy", when: "1h" },
  { who: PEOPLE[2].name, what: "accepted your invite", when: "3h" },
  { who: PEOPLE[4].name, what: "uploaded final files to Pitch deck", when: "1d" },
];

export default function DrawerDemo() {
  const [side, setSide] = useState<DrawerSide | null>(null);
  const [size, setSize] = useState<DrawerSize | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [roomTab, setRoomTab] = useState("details");
  const [invite, setInvite] = useState(false);
  const [edit, setEdit] = useState(false);
  const [title, setTitle] = useState("Brand refresh");
  const [brief, setBrief] = useState("A full identity refresh for a regional coffee roaster.");
  const [visibility, setVisibility] = useState("sealed");
  const [tried, setTried] = useState(false);
  const [filters, setFilters] = useState(false);
  const [statuses, setStatuses] = useState<string[]>(["Open", "Review"]);
  const [budget, setBudget] = useState<[number, number]>([0, 5000]);
  const [sort, setSort] = useState("newest");
  const [nav, setNav] = useState(false);
  const [page, setPage] = useState("Rooms");
  const [inbox, setInbox] = useState(false);
  const [read, setRead] = useState<string[]>([]);

  const matches = ROOMS.filter(
    (r) => statuses.includes(r.status) && r.budget >= budget[0] && r.budget <= budget[1],
  );

  return (
    <Examples>
      <Preview
        align="start"
        label="Sides"
        description="start and end slide from the sides (mirrored under RTL); top and bottom span the width."
      >
        <Row>
          {SIDES.map((s) => (
            <Button key={s} label={s} onClick={() => setSide(s)} />
          ))}
        </Row>
        {SIDES.map((s) => (
          <Drawer
            key={s}
            side={s}
            size={s === "top" || s === "bottom" ? 280 : "sm"}
            isOpen={side === s}
            onOpenChange={(o) => setSide(o ? s : null)}
            title={`side="${s}"`}
          >
            <Text color="secondary">Press Escape, click the scrim, or use the close button.</Text>
          </Drawer>
        ))}
      </Preview>

      <Preview
        align="start"
        label="Sizes"
        description="sm 360, md 480 (default), lg 720, or full — any number or CSS length works too."
      >
        <Row>
          {SIZES.map((s) => (
            <Button key={s} label={s} variant="secondary" onClick={() => setSize(s)} />
          ))}
        </Row>
        {SIZES.map((s) => (
          <Drawer
            key={s}
            size={s}
            isOpen={size === s}
            onOpenChange={(o) => setSize(o ? s : null)}
            title={`size="${s}"`}
          >
            <Text color="secondary">Wider drawers suit tables and side-by-side comparisons.</Text>
          </Drawer>
        ))}
      </Preview>

      <Preview
        label="Record details"
        description="Click a row. The drawer keeps the table in view — tabs, metadata, activity, and header actions."
      >
        <Table
          columns={COLUMNS}
          rows={ROOMS}
          rowKey={(r) => r.id}
          onRowClick={(r) => {
            setRoom(r);
            setRoomTab("details");
          }}
          variant="plain"
        />
        <Drawer
          isOpen={room !== null}
          onOpenChange={(o) => !o && setRoom(null)}
          title={room?.title ?? ""}
          subtitle={room ? `${room.bids} bids · owned by ${room.owner}` : undefined}
          headerActions={
            <HStack gap={1}>
              <IconButton
                label="Share"
                variant="ghost"
                size="sm"
                icon={<Icon icon={icons.share} />}
              />
              <MoreMenu
                label="Room actions"
                items={[
                  { label: "Duplicate" },
                  { label: "Archive" },
                  { type: "divider" },
                  { label: "Delete", variant: "destructive" },
                ]}
              />
            </HStack>
          }
          footer={
            <HStack gap={2} hAlign="end">
              <Button
                label="Invite people"
                icon={<Icon icon={icons.users} />}
                onClick={() => setInvite(true)}
              />
              <Button label="Compare bids" variant="primary" />
            </HStack>
          }
        >
          {room && (
            <Stack gap={4}>
              <TabList value={roomTab} onChange={setRoomTab} hasDivider>
                <Tab value="details" label="Details" />
                <Tab value="activity" label="Activity" />
              </TabList>
              {roomTab === "details" ? (
                <MetadataList columns="single" label={{ position: "start", width: 100 }}>
                  <MetadataListItem label="Status">
                    <Badge label={room.status} variant={STATUS_VARIANT[room.status]} />
                  </MetadataListItem>
                  <MetadataListItem label="Owner">
                    <HStack gap={2} vAlign="center">
                      <Avatar name={room.owner} size="xsm" tooltip={false} />
                      <Text>{room.owner}</Text>
                    </HStack>
                  </MetadataListItem>
                  <MetadataListItem label="Budget">{usd(room.budget)}</MetadataListItem>
                  <MetadataListItem label="Bids">{room.bids}</MetadataListItem>
                </MetadataList>
              ) : (
                <Timeline
                  variant="compact"
                  items={[
                    { id: "1", title: "Room created", time: "Mon", tone: "neutral" },
                    { id: "2", title: `${room.bids} bids received`, time: "Wed", tone: "accent" },
                    { id: "3", title: `Moved to ${room.status}`, time: "Today", tone: "success" },
                  ]}
                />
              )}
            </Stack>
          )}
        </Drawer>
        <Drawer
          size="sm"
          isOpen={invite}
          onOpenChange={setInvite}
          title="Invite people"
          subtitle={room?.title}
          footer={<Button label="Done" variant="primary" onClick={() => setInvite(false)} />}
        >
          <List>
            {PEOPLE.map((p) => (
              <ListItem
                key={p.name}
                label={p.name}
                description={p.role}
                startContent={<Avatar name={p.name} size="sm" tooltip={false} />}
                endContent={<Button label="Invite" size="sm" />}
              />
            ))}
          </List>
        </Drawer>
        <Caption>
          Invite people opens a second drawer on top — stacked drawers for a quick side task.
        </Caption>
      </Preview>

      <Preview
        align="start"
        label="Edit form"
        description='purpose="form" keeps focus inside; the footer keeps Save in reach as the form scrolls.'
      >
        <Row>
          <Button
            label="Edit room"
            icon={<Icon icon={icons.edit} />}
            onClick={() => setEdit(true)}
          />
          <Caption>
            {title} · {visibility}
          </Caption>
        </Row>
        <Drawer
          isOpen={edit}
          onOpenChange={setEdit}
          purpose="form"
          title="Edit room"
          footer={
            <HStack gap={2} hAlign="end">
              <Button label="Cancel" variant="ghost" onClick={() => setEdit(false)} />
              <Button
                label="Save changes"
                variant="primary"
                onClick={() => {
                  setTried(true);
                  if (title.trim()) setEdit(false);
                }}
              />
            </HStack>
          }
        >
          <FormLayout>
            <TextInput
              label="Title"
              isRequired
              value={title}
              onChange={setTitle}
              status={
                tried && !title.trim()
                  ? { type: "error", message: "Give the room a title." }
                  : undefined
              }
            />
            <TextArea label="Brief" value={brief} onChange={setBrief} rows={6} />
            <Selector
              label="Visibility"
              value={visibility}
              onChange={setVisibility}
              options={[
                {
                  value: "sealed",
                  label: "Sealed",
                  description: "Bids stay hidden until the deadline.",
                },
                { value: "open", label: "Open", description: "Everyone sees the lowest bid." },
              ]}
            />
          </FormLayout>
        </Drawer>
      </Preview>

      <Preview
        align="start"
        label="Filters"
        description="From the start edge, with a live count on the Apply button."
      >
        <Row>
          <Button
            label="Filters"
            icon={<Icon icon={icons.filter} />}
            endContent={<Badge label={statuses.length} variant="info" />}
            onClick={() => setFilters(true)}
          />
          <Caption>
            {matches.length} of {ROOMS.length} rooms · sorted by {sort}
          </Caption>
        </Row>
        <Drawer
          side="start"
          size="sm"
          isOpen={filters}
          onOpenChange={setFilters}
          title="Filter rooms"
          footer={
            <HStack gap={2} hAlign="between">
              <Button
                label="Clear"
                variant="ghost"
                onClick={() => {
                  setStatuses(["Open", "Review", "Awarded"]);
                  setBudget([0, BUDGET_MAX]);
                }}
              />
              <Button
                label={`Show ${matches.length} rooms`}
                variant="primary"
                onClick={() => setFilters(false)}
              />
            </HStack>
          }
        >
          <Stack gap={5}>
            <CheckboxList label="Status" value={statuses} onChange={setStatuses}>
              {(["Open", "Review", "Awarded"] as const).map((s) => (
                <CheckboxListItem
                  key={s}
                  value={s}
                  label={s}
                  endContent={
                    <Text color="secondary">{ROOMS.filter((r) => r.status === s).length}</Text>
                  }
                />
              ))}
            </CheckboxList>
            <Slider
              label="Budget"
              value={budget}
              onChange={setBudget}
              min={0}
              max={BUDGET_MAX}
              step={BUDGET_STEP}
              valueDisplay="text"
              formatValue={usd}
            />
            <RadioList label="Sort by" value={sort} onChange={setSort}>
              <RadioListItem value="newest" label="Newest" />
              <RadioListItem value="budget" label="Highest budget" />
              <RadioListItem value="bids" label="Most bids" />
            </RadioList>
          </Stack>
        </Drawer>
      </Preview>

      <Preview
        align="start"
        label="Mobile navigation"
        description="A side nav in a start drawer — the menu button pattern on small screens."
      >
        <Row>
          <IconButton label="Open menu" icon={<Icon icon="menu" />} onClick={() => setNav(true)} />
          <Caption>Current page: {page}</Caption>
        </Row>
        <Drawer side="start" size={280} isOpen={nav} onOpenChange={setNav} title="Joined">
          <SideNav>
            {[
              { label: "Home", icon: icons.home },
              { label: "Rooms", icon: icons.seat },
              { label: "Messages", icon: icons.mail },
              { label: "Settings", icon: icons.settings },
            ].map((item) => (
              <SideNavItem
                key={item.label}
                label={item.label}
                icon={<Icon icon={item.icon} />}
                isSelected={page === item.label}
                onClick={() => {
                  setPage(item.label);
                  setNav(false);
                }}
              />
            ))}
          </SideNav>
        </Drawer>
      </Preview>

      <Preview
        align="start"
        label="Notifications"
        description="A narrow end drawer with a list and a header action."
      >
        <Row>
          <Button
            label="Notifications"
            icon={<Icon icon={icons.bell} />}
            endContent={
              NOTIFICATIONS.length - read.length ? (
                <Badge label={NOTIFICATIONS.length - read.length} variant="error" />
              ) : undefined
            }
            onClick={() => setInbox(true)}
          />
        </Row>
        <Drawer
          size="sm"
          isOpen={inbox}
          onOpenChange={setInbox}
          title="Notifications"
          headerActions={
            <Button
              label="Mark all read"
              size="sm"
              variant="ghost"
              onClick={() => setRead(NOTIFICATIONS.map((n) => n.who))}
            />
          }
        >
          <List hasDividers>
            {NOTIFICATIONS.map((n) => (
              <ListItem
                key={n.who}
                label={n.what}
                description={`${n.who} · ${n.when}`}
                startContent={<Avatar name={n.who} size="sm" tooltip={false} />}
                endContent={read.includes(n.who) ? undefined : <Badge label="New" variant="info" />}
                onClick={() => setRead((r) => (r.includes(n.who) ? r : [...r, n.who]))}
              />
            ))}
          </List>
        </Drawer>
      </Preview>
    </Examples>
  );
}
