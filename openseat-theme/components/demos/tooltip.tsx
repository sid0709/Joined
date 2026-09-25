"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  HStack,
  Icon,
  IconButton,
  Kbd,
  StatusDot,
  Stack,
  Text,
  Tooltip,
  icons,
} from "@openseat/design-system";
import { Examples, Preview, Row } from "./shared";

const PLACEMENTS = ["above", "below", "start", "end"] as const;
const TOOLS = [
  { label: "Bold", icon: icons.bold, keys: "mod+b" },
  { label: "Italic", icon: icons.italic, keys: "mod+i" },
  { label: "Underline", icon: icons.underline, keys: "mod+u" },
  { label: "Link", icon: icons.link, keys: "mod+k" },
];

export default function TooltipDemo() {
  const [forced, setForced] = useState(false);

  return (
    <Examples>
      <Preview align="start" label="Icon buttons" description="The most common use — name a control that has no visible label.">
        <Row>
          <Tooltip content="Search the library">
            <IconButton label="Search" icon={<Icon icon="search" />} />
          </Tooltip>
          <Tooltip content="Settings">
            <IconButton label="Settings" icon={<Icon icon={icons.settings} />} variant="ghost" />
          </Tooltip>
          <Tooltip content="Delete room">
            <IconButton label="Delete" icon={<Icon icon={icons.trash} />} variant="destructive" />
          </Tooltip>
        </Row>
      </Preview>

      <Preview align="start" label="With shortcuts" description="Content can be any node — a label with its keyboard shortcut.">
        <HStack gap={1}>
          {TOOLS.map((t) => (
            <Tooltip
              key={t.label}
              content={
                <HStack gap={2} vAlign="center">
                  <span>{t.label}</span>
                  <Kbd keys={t.keys} />
                </HStack>
              }
            >
              <IconButton label={t.label} variant="ghost" icon={<Icon icon={t.icon} />} />
            </Tooltip>
          ))}
        </HStack>
      </Preview>

      <Preview align="start" label="Placement">
        <Row>
          {PLACEMENTS.map((placement) => (
            <Tooltip key={placement} content={`Placed ${placement}`} placement={placement}>
              <Button label={placement} />
            </Tooltip>
          ))}
        </Row>
      </Preview>

      <Preview align="start" label="Delay" description="Short for toolbars people scan; longer where tooltips would get in the way.">
        <Row>
          <Tooltip content="Instant" delay={0}>
            <Button label="0 ms" />
          </Tooltip>
          <Tooltip content="Default delay">
            <Button label="Default" />
          </Tooltip>
          <Tooltip content="Waited a full second" delay={1000}>
            <Button label="1000 ms" />
          </Tooltip>
        </Row>
      </Preview>

      <Preview align="start" label="Explain truncation and status" description="Reveal full text or explain a state on hover.">
        <Card maxWidth={320}>
          <Stack gap={2}>
            <Tooltip content="Full identity refresh for a regional coffee roaster, including packaging and signage">
              <Text maxLines={1}>Full identity refresh for a regional coffee roaster, including packaging and signage</Text>
            </Tooltip>
            <HStack gap={2} vAlign="center">
              <Tooltip content="Synced 2 minutes ago">
                <span>
                  <StatusDot variant="success" label="Synced" />
                </span>
              </Tooltip>
              <Text type="supporting" color="secondary">
                Calendar sync
              </Text>
            </HStack>
          </Stack>
        </Card>
      </Preview>

      <Preview align="start" label="Disabled control" description="Wrap disabled buttons so people still learn why.">
        <Tooltip content="Available after the room closes">
          <span>
            <Button label="Award" variant="primary" isDisabled />
          </span>
        </Tooltip>
      </Preview>

      <Preview align="start" label="Controlled" description="isOpen for onboarding hints you show on purpose.">
        <Row>
          <Tooltip content="Start here — post your first room" isOpen={forced} placement="end">
            <Button label="Post a room" variant="primary" icon={<Icon icon={icons.plus} />} />
          </Tooltip>
          <Button label={forced ? "Hide hint" : "Show hint"} size="sm" variant="ghost" onClick={() => setForced((f) => !f)} />
          <Badge label="Tip" variant="purple" />
        </Row>
      </Preview>
    </Examples>
  );
}
