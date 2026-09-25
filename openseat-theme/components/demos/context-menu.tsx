"use client";

import { useState } from "react";
import {
  Avatar,
  Badge,
  Card,
  ContextMenu,
  HStack,
  Heading,
  Icon,
  Stack,
  Text,
  Thumbnail,
  icons,
  type ContextMenuOption,
} from "@openseat/design-system";
import { Caption, Examples, PEOPLE, Preview, SAMPLE_IMAGES } from "./shared";

const FILES = [
  { name: "brief.pdf", src: SAMPLE_IMAGES.file },
  { name: "moodboard.svg", src: SAMPLE_IMAGES.window },
  { name: "logo-v2.svg", src: SAMPLE_IMAGES.globe },
];

export default function ContextMenuDemo() {
  const [log, setLog] = useState<string[]>([]);
  const [pinned, setPinned] = useState<string[]>([]);
  const note = (entry: string) => setLog((l) => [entry, ...l].slice(0, 4));

  const roomMenu = (room: string): ContextMenuOption[] => [
    { label: "Open", icon: <Icon icon={icons.eye} />, onClick: () => note(`Open ${room}`) },
    { label: "Duplicate", icon: <Icon icon={icons.plus} />, onClick: () => note(`Duplicate ${room}`) },
    {
      label: pinned.includes(room) ? "Unpin" : "Pin",
      icon: <Icon icon={icons.pin} />,
      onClick: () => setPinned((p) => (p.includes(room) ? p.filter((r) => r !== room) : [...p, room])),
    },
    {
      label: "Move to",
      icon: <Icon icon={icons.folder} />,
      items: ["Active", "Archive", "Templates"].map((f) => ({ label: f, onClick: () => note(`Move ${room} to ${f}`) })),
    },
    { type: "divider" },
    { label: "Delete", icon: <Icon icon={icons.trash} />, variant: "destructive", onClick: () => note(`Delete ${room}`) },
  ];

  return (
    <Examples>
      <Preview label="Right-click a card" description="Icons, a submenu, a divider, and a destructive action.">
        <HStack gap={3} wrap="wrap">
          {["Brand refresh", "Motion system", "Pitch deck"].map((room) => (
            <ContextMenu key={room} items={roomMenu(room)} label={`${room} actions`}>
              <Card width={200}>
                <Stack gap={1}>
                  <HStack gap={2} vAlign="center">
                    {pinned.includes(room) && <Icon icon={icons.pin} size="sm" color="accent" />}
                    <Heading level={4}>{room}</Heading>
                  </HStack>
                  <Text type="supporting" color="secondary">
                    Right-click or long-press
                  </Text>
                </Stack>
              </Card>
            </ContextMenu>
          ))}
        </HStack>
      </Preview>

      <Preview label="Sections and descriptions" description="Group actions and explain the risky ones.">
        <ContextMenu
          items={[
            {
              type: "section",
              title: "Bid",
              items: [
                { label: "Shortlist", icon: <Icon icon={icons.star} />, onClick: () => note("Shortlist Jordan") },
                { label: "Message", icon: <Icon icon={icons.mail} />, onClick: () => note("Message Jordan") },
              ],
            },
            {
              type: "section",
              title: "Decision",
              items: [
                { label: "Award", description: "Closes the room and notifies everyone.", icon: <Icon icon={icons.check} />, onClick: () => note("Award Jordan") },
                { label: "Reject", description: "Jordan sees a polite note.", variant: "destructive", icon: <Icon icon={icons.close} />, onClick: () => note("Reject Jordan") },
              ],
            },
          ]}
          menuWidth={280}
        >
          <Card maxWidth={360}>
            <HStack gap={3} vAlign="center" hAlign="between">
              <HStack gap={2} vAlign="center">
                <Avatar name={PEOPLE[0].name} size="sm" tooltip={false} />
                <Text weight="semibold">{PEOPLE[0].name}</Text>
              </HStack>
              <Badge label="$2,400" variant="info" />
            </HStack>
          </Card>
        </ContextMenu>
      </Preview>

      <Preview label="On files" description="A compact menu on each thumbnail, with a disabled item.">
        <HStack gap={3}>
          {FILES.map((f) => (
            <ContextMenu
              key={f.name}
              size="sm"
              items={[
                { label: "Preview", onClick: () => note(`Preview ${f.name}`) },
                { label: "Download", icon: <Icon icon={icons.download} />, onClick: () => note(`Download ${f.name}`) },
                { label: "Rename", isDisabled: true },
                { type: "divider" },
                { label: "Remove", variant: "destructive", onClick: () => note(`Remove ${f.name}`) },
              ]}
            >
              <Stack gap={1} hAlign="center">
                <Thumbnail src={f.src} label={f.name} alt={f.name} />
                <Caption>{f.name}</Caption>
              </Stack>
            </ContextMenu>
          ))}
        </HStack>
      </Preview>

      <Preview label="Disabled" description="isDisabled lets the browser menu through — for areas like text inputs.">
        <ContextMenu items={[{ label: "Unused" }]} isDisabled>
          <Card maxWidth={360}>
            <Text color="secondary">Right-click here shows the normal browser menu.</Text>
          </Card>
        </ContextMenu>
      </Preview>

      <Caption>{log.length ? log.join(" · ") : "Actions you pick appear here."}</Caption>
    </Examples>
  );
}
