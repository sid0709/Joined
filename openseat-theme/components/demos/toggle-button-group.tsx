"use client";

import { useState } from "react";
import { Icon, Stack, Text, ToggleButton, ToggleButtonGroup, icons, type ButtonSize } from "@openseat/design-system";
import { Caption, Examples, Preview, Row } from "./shared";

const SIZES: ButtonSize[] = ["sm", "md", "lg"];
const SKILLS = ["Branding", "Web", "Motion", "Illustration", "Copy", "3D"];

export default function ToggleButtonGroupDemo() {
  const [align, setAlign] = useState<string | null>("left");
  const [format, setFormat] = useState<string[]>(["bold"]);
  const [view, setView] = useState<string | null>("list");
  const [skills, setSkills] = useState<string[]>(["Branding", "Web"]);
  const [days, setDays] = useState<string[]>(["mon", "wed", "fri"]);
  const [sizes, setSizes] = useState<Record<ButtonSize, string | null>>({ sm: "a", md: "b", lg: "c" });

  return (
    <Examples>
      <Preview align="start" label="Single — one or none" description="Pressing the active item again clears it, unlike a SegmentedControl.">
        <Stack gap={2} hAlign="start">
          <ToggleButtonGroup label="Text alignment" value={align} onChange={setAlign}>
            <ToggleButton value="left" label="Align left" isIconOnly icon={<Icon icon={icons.alignLeft} />} />
            <ToggleButton value="center" label="Align center" isIconOnly icon={<Icon icon={icons.alignCenter} />} />
            <ToggleButton value="right" label="Align right" isIconOnly icon={<Icon icon={icons.alignRight} />} />
          </ToggleButtonGroup>
          <Caption>Alignment: {align ?? "none"}</Caption>
        </Stack>
      </Preview>

      <Preview align="start" label="Multiple — any combination">
        <Stack gap={2} hAlign="start">
          <ToggleButtonGroup type="multiple" label="Text formatting" value={format} onChange={setFormat}>
            <ToggleButton value="bold" label="Bold" isIconOnly icon={<Icon icon={icons.bold} />} />
            <ToggleButton value="italic" label="Italic" isIconOnly icon={<Icon icon={icons.italic} />} />
            <ToggleButton value="underline" label="Underline" isIconOnly icon={<Icon icon={icons.underline} />} />
            <ToggleButton value="strike" label="Strikethrough" isIconOnly icon={<Icon icon={icons.strike} />} />
          </ToggleButtonGroup>
          <Caption>Formatting: {format.length ? format.join(", ") : "none"}</Caption>
        </Stack>
      </Preview>

      <Preview align="start" label="Labels with icons">
        <ToggleButtonGroup label="Layout" value={view} onChange={setView}>
          <ToggleButton value="list" label="List" icon={<Icon icon={icons.list} />} />
          <ToggleButton value="grid" label="Grid" icon={<Icon icon={icons.grid} />} />
          <ToggleButton value="calendar" label="Calendar" icon={<Icon icon={icons.calendar} />} />
        </ToggleButtonGroup>
      </Preview>

      <Preview align="start" label="Sizes">
        <Stack gap={3} hAlign="start">
          {SIZES.map((size) => (
            <ToggleButtonGroup key={size} label={`${size} group`} size={size} value={sizes[size]} onChange={(v) => setSizes((c) => ({ ...c, [size]: v }))}>
              <ToggleButton value="a" label="One" />
              <ToggleButton value="b" label="Two" />
              <ToggleButton value="c" label="Three" />
            </ToggleButtonGroup>
          ))}
        </Stack>
      </Preview>

      <Preview align="start" label="Vertical">
        <Row>
          <ToggleButtonGroup label="Side panel" orientation="vertical" value={view} onChange={setView}>
            <ToggleButton value="list" label="Outline" icon={<Icon icon={icons.list} />} />
            <ToggleButton value="grid" label="Assets" icon={<Icon icon={icons.image} />} />
            <ToggleButton value="calendar" label="Comments" icon={<Icon icon={icons.mail} />} />
          </ToggleButtonGroup>
        </Row>
      </Preview>

      <Preview align="start" label="Pattern — skill filter chips">
        <Stack gap={2} hAlign="start">
          <ToggleButtonGroup type="multiple" label="Skills" size="sm" value={skills} onChange={setSkills}>
            {SKILLS.map((skill) => (
              <ToggleButton key={skill} value={skill} label={skill} />
            ))}
          </ToggleButtonGroup>
          <Text type="supporting" color="secondary">
            {skills.length} of {SKILLS.length} skills — {skills.join(", ") || "any"}
          </Text>
        </Stack>
      </Preview>

      <Preview align="start" label="Pattern — weekday picker">
        <Stack gap={2} hAlign="start">
          <ToggleButtonGroup type="multiple" label="Available days" value={days} onChange={setDays}>
            {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => (
              <ToggleButton key={day} value={day} label={day[0].toUpperCase() + day.slice(1)} />
            ))}
          </ToggleButtonGroup>
          <Caption>Available {days.length} days a week.</Caption>
        </Stack>
      </Preview>

      <Preview align="start" label="Disabled">
        <ToggleButtonGroup label="Locked" value="a" onChange={() => {}} isDisabled>
          <ToggleButton value="a" label="Draft" />
          <ToggleButton value="b" label="Published" />
        </ToggleButtonGroup>
      </Preview>
    </Examples>
  );
}
