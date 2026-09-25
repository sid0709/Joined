"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Button,
  Card,
  CommandPalette,
  CommandPaletteFooter,
  HStack,
  Icon,
  Kbd,
  Stack,
  Text,
  createStaticSource,
  icons,
  type SearchableItem,
} from "@openseat/design-system";
import { Caption, Examples, PEOPLE, Preview, Row } from "./shared";

type Command = SearchableItem<{ group: string; icon: Parameters<typeof Icon>[0]["icon"]; shortcut?: string }>;

const COMMANDS: Command[] = [
  { id: "new-room", label: "New room", auxiliaryData: { group: "Actions", icon: icons.plus, shortcut: "mod+shift+n" } },
  { id: "invite", label: "Invite people", auxiliaryData: { group: "Actions", icon: icons.users, shortcut: "mod+i" } },
  { id: "export", label: "Export bids", auxiliaryData: { group: "Actions", icon: icons.download } },
  { id: "rooms", label: "Go to rooms", auxiliaryData: { group: "Navigation", icon: icons.seat, shortcut: "g+r" } },
  { id: "messages", label: "Go to messages", auxiliaryData: { group: "Navigation", icon: icons.mail, shortcut: "g+m" } },
  { id: "settings", label: "Open settings", auxiliaryData: { group: "Navigation", icon: icons.settings, shortcut: "mod+comma" } },
  { id: "theme", label: "Toggle dark mode", auxiliaryData: { group: "Preferences", icon: icons.sparkle } },
];
const PEOPLE_ITEMS: SearchableItem<{ role: string }>[] = PEOPLE.map((p) => ({ id: p.name, label: p.name, auxiliaryData: { role: p.role } }));
const PALETTE_WIDTH = 560;

export default function CommandPaletteDemo() {
  const commands = useMemo(() => createStaticSource(COMMANDS, { keywords: (c) => [c.auxiliaryData?.group ?? ""] }), []);
  const people = useMemo(() => createStaticSource(PEOPLE_ITEMS, { keywords: (p) => [p.auxiliaryData?.role ?? ""] }), []);
  const [open, setOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [ran, setRan] = useState<string | null>(null);
  const [inlineValue, setInlineValue] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Examples>
      <Preview align="start" label="Actions with shortcuts" description="Press ⌘K / Ctrl+K anywhere on this page, or use the button.">
        <Stack gap={2}>
          <Row>
            <Button label="Search commands" icon={<Icon icon={icons.search} />} endContent={<Kbd keys="mod+k" />} onClick={() => setOpen(true)} />
          </Row>
          <Caption>{ran ? `Ran “${ran}”` : "Pick a command to run it."}</Caption>
        </Stack>
        <CommandPalette
          isOpen={open}
          onOpenChange={setOpen}
          searchSource={commands}
          label="Commands"
          width={PALETTE_WIDTH}
          onValueChange={(id) => {
            setRan(COMMANDS.find((c) => c.id === id)?.label ?? id);
            setOpen(false);
          }}
          renderItem={(c) => (
            <HStack gap={3} vAlign="center" hAlign="between" width="100%">
              <HStack gap={2} vAlign="center">
                {c.auxiliaryData && <Icon icon={c.auxiliaryData.icon} size="sm" color="secondary" />}
                <Text>{c.label}</Text>
                <Text type="supporting" color="secondary">
                  {c.auxiliaryData?.group}
                </Text>
              </HStack>
              {c.auxiliaryData?.shortcut && <Kbd keys={c.auxiliaryData.shortcut} />}
            </HStack>
          )}
          footer={
            <CommandPaletteFooter>
              <HStack gap={3}>
                <Text type="supporting" color="secondary">
                  <Kbd keys="up" /> <Kbd keys="down" /> to move
                </Text>
                <Text type="supporting" color="secondary">
                  <Kbd keys="enter" /> to run
                </Text>
                <Text type="supporting" color="secondary">
                  <Kbd keys="esc" /> to close
                </Text>
              </HStack>
            </CommandPaletteFooter>
          }
          emptySearchText="No command matches."
        />
      </Preview>

      <Preview align="start" label="People finder" description="Any searchable source — here, people with avatars and roles.">
        <Row>
          <Button label="Find a person" icon={<Icon icon={icons.users} />} onClick={() => setPeopleOpen(true)} />
        </Row>
        <CommandPalette
          isOpen={peopleOpen}
          onOpenChange={setPeopleOpen}
          searchSource={people}
          label="People"
          width={PALETTE_WIDTH}
          emptyBootstrapText="Type a name or a role."
          onValueChange={(id) => {
            setRan(`Open ${id}`);
            setPeopleOpen(false);
          }}
          renderItem={(p) => (
            <HStack gap={2} vAlign="center">
              <Avatar name={p.label} size="xsm" tooltip={false} />
              <Text>{p.label}</Text>
              <Text type="supporting" color="secondary">
                {p.auxiliaryData?.role}
              </Text>
            </HStack>
          )}
        />
      </Preview>

      <Preview label="Inline" description="isInline renders the palette in the page — a search panel that never closes.">
        <Card padding={0} maxWidth={PALETTE_WIDTH}>
          <CommandPalette isInline isOpen onOpenChange={() => undefined} searchSource={commands} label="Quick actions" maxHeight={280} value={inlineValue} onValueChange={setInlineValue} />
        </Card>
        <Caption>{inlineValue ? `Selected ${inlineValue}` : "Use the arrows and Enter."}</Caption>
      </Preview>
    </Examples>
  );
}
