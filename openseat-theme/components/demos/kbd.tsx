"use client";

import { Button, Card, HStack, Icon, Kbd, Stack, Text, icons } from "@openseat/design-system";
import { Caption, Examples, Preview, Row } from "./shared";

const SINGLE = ["enter", "esc", "tab", "backspace", "shift", "alt", "ctrl", "mod"];
const ARROWS = ["up", "down", "left", "right"];
const COMBOS = ["mod+k", "mod+enter", "mod+shift+p", "alt+shift+d", "ctrl+tab", "shift+plus"];
const SHORTCUTS = [
  { action: "Open command palette", keys: "mod+k" },
  { action: "New room", keys: "mod+shift+n" },
  { action: "Submit bid", keys: "mod+enter" },
  { action: "Search rooms", keys: "/" },
  { action: "Next room", keys: "j" },
  { action: "Previous room", keys: "k" },
  { action: "Close panel", keys: "esc" },
];

export default function KbdDemo() {
  return (
    <Examples>
      <Preview align="start" label="Special keys" description="Named keys render as their symbol. mod is ⌘ on macOS and Ctrl elsewhere.">
        <Row>
          {SINGLE.map((keys) => (
            <Stack key={keys} gap={1} hAlign="center">
              <Kbd keys={keys} />
              <Caption>{keys}</Caption>
            </Stack>
          ))}
        </Row>
      </Preview>

      <Preview align="start" label="Arrows">
        <Row>
          {ARROWS.map((keys) => (
            <Kbd key={keys} keys={keys} />
          ))}
        </Row>
      </Preview>

      <Preview align="start" label="Combinations" description="Separate keys with +. Use plus for a literal + key.">
        <Stack gap={2} hAlign="start">
          {COMBOS.map((keys) => (
            <HStack key={keys} gap={3} vAlign="center">
              <Kbd keys={keys} />
              <Caption>{keys}</Caption>
            </HStack>
          ))}
        </Stack>
      </Preview>

      <Preview label="In copy" description="Kbd sits inline and follows the line height.">
        <Stack gap={2}>
          <Text display="block">
            Press <Kbd keys="mod+k" /> to open the command palette, then <Kbd keys="enter" /> to run the first match.
          </Text>
          <Text type="supporting" color="secondary" display="block">
            Tip: <Kbd keys="shift+enter" /> adds a new line without sending.
          </Text>
        </Stack>
      </Preview>

      <Preview align="start" label="In a button" description="Show the shortcut as end content so people learn it.">
        <Row>
          <Button label="Search" icon={<Icon icon={icons.search} />} endContent={<Kbd keys="mod+k" />} />
          <Button label="Submit bid" variant="primary" endContent={<Kbd keys="mod+enter" />} />
          <Button label="Close" variant="ghost" endContent={<Kbd keys="esc" />} />
        </Row>
      </Preview>

      <Preview label="Shortcut sheet" description="Action on the left, keys on the right.">
        <Card>
          <Stack gap={2}>
            {SHORTCUTS.map(({ action, keys }) => (
              <HStack key={action} hAlign="between" vAlign="center" gap={3}>
                <Text>{action}</Text>
                <Kbd keys={keys} />
              </HStack>
            ))}
          </Stack>
        </Card>
      </Preview>
    </Examples>
  );
}
