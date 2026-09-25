"use client";

import { useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CheckboxInput,
  HStack,
  Heading,
  Icon,
  IconButton,
  List,
  ListItem,
  Stack,
  StatusDot,
  Switch,
  Text,
  Timestamp,
  icons,
  type ListDensity,
} from "@openseat/design-system";
import { Caption, Examples, PEOPLE, Preview } from "./shared";

const DENSITIES: ListDensity[] = ["compact", "balanced", "spacious"];
const WIDTH = 440;
const HOUR = 3600;
const ROOMS = [
  { id: "brand", title: "Brand refresh", meta: "Fixed · $2,400", status: "Open" as const, bids: 6 },
  { id: "landing", title: "Landing page copy", meta: "Hourly · $65/hr", status: "Review" as const, bids: 2 },
  { id: "motion", title: "Motion system", meta: "Fixed · $3,200", status: "Draft" as const, bids: 0 },
];
const STATUS_VARIANT = { Open: "success", Review: "warning", Draft: "neutral" } as const;
const TASKS = ["Write the brief", "Set a budget", "Invite three people", "Pick a deadline"];
const NOTIFICATIONS = [
  { who: PEOPLE[0].name, what: "submitted a bid on Brand refresh", ago: 0.2 },
  { who: PEOPLE[1].name, what: "asked a question about the budget", ago: 3 },
  { who: PEOPLE[2].name, what: "declined the invite", ago: 26 },
];

export default function ListDemo() {
  const [selected, setSelected] = useState("brand");
  const [done, setDone] = useState<string[]>([TASKS[0]]);
  const [settings, setSettings] = useState({ bids: true, digest: false });
  const [unread, setUnread] = useState(NOTIFICATIONS.map((n) => n.who));
  const [now] = useState(() => Math.floor(Date.now() / 1000));

  return (
    <Examples>
      <Preview label="Markers" description="listStyle for plain text lists — bullets, numbers, circles, or none.">
        <HStack gap={6} wrap="wrap" vAlign="start">
          {(["disc", "decimal", "circle", "none"] as const).map((listStyle) => (
            <Stack key={listStyle} gap={1}>
              <Caption>{listStyle}</Caption>
              <List listStyle={listStyle}>
                {TASKS.slice(0, 3).map((t) => (
                  <ListItem key={t} label={t} />
                ))}
              </List>
            </Stack>
          ))}
        </HStack>
      </Preview>

      <Preview label="Numbered from any start" description="start continues a numbered list across sections.">
        <List listStyle="decimal" start={4}>
          <ListItem label="Compare bids side by side" />
          <ListItem label="Award in one click" />
        </List>
      </Preview>

      <Preview label="Density and dividers">
        <HStack gap={4} wrap="wrap" vAlign="start">
          {DENSITIES.map((density) => (
            <Card key={density} width={220}>
              <List density={density} hasDividers header={<Text type="label">{density}</Text>}>
                {PEOPLE.slice(0, 3).map((p) => (
                  <ListItem key={p.name} label={p.name} />
                ))}
              </List>
            </Card>
          ))}
        </HStack>
      </Preview>

      <Preview label="Rich rows" description="Start content, a description, and end content make a full row.">
        <Card maxWidth={WIDTH}>
          <List hasDividers>
            {PEOPLE.slice(0, 4).map((p, i) => (
              <ListItem
                key={p.name}
                label={p.name}
                description={p.role}
                startContent={<Avatar name={p.name} tooltip={false} />}
                endContent={<Text hasTabularNumbers color="secondary">${(2400 + i * 250).toLocaleString()}</Text>}
              />
            ))}
          </List>
        </Card>
      </Preview>

      <Preview label="Selectable navigation" description="onClick and isSelected turn rows into a master list.">
        <HStack gap={4} vAlign="start" wrap="wrap">
          <Card width={260} padding={2}>
            <List>
              {ROOMS.map((r) => (
                <ListItem
                  key={r.id}
                  label={r.title}
                  description={r.meta}
                  isSelected={selected === r.id}
                  onClick={() => setSelected(r.id)}
                  isDisabled={r.status === "Draft"}
                  endContent={<Badge label={r.bids} variant={r.bids ? "info" : "neutral"} />}
                />
              ))}
            </List>
          </Card>
          <Card width={220}>
            <Stack gap={1}>
              <Heading level={4}>{ROOMS.find((r) => r.id === selected)?.title}</Heading>
              <Badge label={ROOMS.find((r) => r.id === selected)?.status ?? ""} variant={STATUS_VARIANT[ROOMS.find((r) => r.id === selected)?.status ?? "Draft"]} />
            </Stack>
          </Card>
        </HStack>
      </Preview>

      <Preview label="Links" description="href makes each row a link — a settings index or a sitemap.">
        <Card maxWidth={WIDTH}>
          <List hasDividers>
            {[
              { label: "Profile", description: "Name, photo, and bio", icon: icons.user },
              { label: "Notifications", description: "Email and in-app alerts", icon: icons.bell },
              { label: "Billing", description: "Plan, invoices, and payouts", icon: icons.file },
            ].map((s) => (
              <ListItem key={s.label} label={s.label} description={s.description} href={`#${s.label}`} startContent={<Icon icon={s.icon} />} endContent={<Icon icon={icons.chevronRight} color="tertiary" />} />
            ))}
          </List>
        </Card>
      </Preview>

      <Preview label="Checklist" description="Controls in rows — a setup list that tracks progress.">
        <Card maxWidth={WIDTH}>
          <List header={<Text type="label">Setup · {done.length} of {TASKS.length}</Text>}>
            {TASKS.map((t) => (
              <ListItem
                key={t}
                label={<CheckboxInput label={t} value={done.includes(t)} onChange={(on) => setDone((d) => (on ? [...d, t] : d.filter((x) => x !== t)))} />}
                aria-label={t}
              />
            ))}
          </List>
        </Card>
      </Preview>

      <Preview label="Settings rows" description="Switches at the end of each row.">
        <Card maxWidth={WIDTH}>
          <List hasDividers>
            <ListItem label="Email for new bids" description="One email per bid" endContent={<Switch label="Email for new bids" isLabelHidden value={settings.bids} onChange={(v) => setSettings((s) => ({ ...s, bids: v }))} />} />
            <ListItem label="Weekly digest" description="Mondays at 8 AM" endContent={<Switch label="Weekly digest" isLabelHidden value={settings.digest} onChange={(v) => setSettings((s) => ({ ...s, digest: v }))} />} />
          </List>
        </Card>
      </Preview>

      <Preview label="Notifications" description="Unread dots, timestamps, and a per-row action.">
        <Card maxWidth={WIDTH + 40}>
          <Stack gap={2}>
            <HStack hAlign="between" vAlign="center">
              <Heading level={4}>Notifications</Heading>
              <Button label="Mark all read" size="sm" variant="ghost" onClick={() => setUnread([])} isDisabled={!unread.length} />
            </HStack>
            <List hasDividers>
              {NOTIFICATIONS.map((n) => (
                <ListItem
                  key={n.who}
                  label={
                    <Text>
                      <Text weight="semibold">{n.who}</Text> {n.what}
                    </Text>
                  }
                  aria-label={`${n.who} ${n.what}`}
                  description={<Timestamp value={now - n.ago * HOUR} format="relative" />}
                  startContent={
                    <HStack gap={2} vAlign="center">
                      <StatusDot variant={unread.includes(n.who) ? "accent" : "neutral"} label={unread.includes(n.who) ? "Unread" : "Read"} />
                      <Avatar name={n.who} size="sm" tooltip={false} />
                    </HStack>
                  }
                  endContent={<IconButton label="Dismiss" variant="ghost" size="sm" icon={<Icon icon={icons.close} />} onClick={() => setUnread((u) => u.filter((x) => x !== n.who))} />}
                />
              ))}
            </List>
          </Stack>
        </Card>
      </Preview>
    </Examples>
  );
}
