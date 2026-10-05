"use client";

import { Badge, Card, HStack, Heading, Icon, Slider, Stack, Text, icons } from "sid-ui";
import { useState } from "react";

import { Caption, Examples, Preview } from "./shared";

const FIELD_WIDTH = 360;
const BUDGET_MIN = 0;
const BUDGET_MAX = 10000;
const BUDGET_STEP = 250;
const ROOMS = [
  { title: "Pitch deck", budget: 950 },
  { title: "Icon set", budget: 1200 },
  { title: "Landing page", budget: 1800 },
  { title: "Brand refresh", budget: 2400 },
  { title: "Motion system", budget: 3200 },
  { title: "Onboarding flow", budget: 4100 },
  { title: "Website rebuild", budget: 8500 },
];
const DAY_MARKS = [
  { value: 1, label: "1 d" },
  { value: 7, label: "1 wk" },
  { value: 14, label: "2 wk" },
  { value: 30, label: "1 mo" },
];
const EQ = ["Bass", "Mid", "Treble", "Voice"];

const usd = (v: number) => `$${v.toLocaleString()}`;

export default function SliderDemo() {
  const [volume, setVolume] = useState(60);
  const [range, setRange] = useState<[number, number]>([1000, 4000]);
  const [days, setDays] = useState(14);
  const [committed, setCommitted] = useState(14);
  const [confidence, setConfidence] = useState(70);
  const [eq, setEq] = useState<number[]>([4, 0, -2, 3]);

  const matches = ROOMS.filter((r) => r.budget >= range[0] && r.budget <= range[1]);

  return (
    <Examples>
      <Preview
        align="start"
        label="Single value"
        description="The value shows in a tooltip while dragging."
      >
        <Stack width={FIELD_WIDTH}>
          <Slider label="Volume" value={volume} onChange={setVolume} />
        </Stack>
      </Preview>

      <Preview
        align="start"
        label="Value display"
        description="tooltip (default), text beside the label, or none."
      >
        <Stack gap={4} width={FIELD_WIDTH}>
          <Slider label="Tooltip" value={volume} onChange={setVolume} valueDisplay="tooltip" />
          <Slider
            label="Text"
            value={volume}
            onChange={setVolume}
            valueDisplay="text"
            formatValue={(v) => `${v}%`}
          />
          <Slider label="None" value={volume} onChange={setVolume} valueDisplay="none" />
        </Stack>
      </Preview>

      <Preview
        align="start"
        label="Marks and steps"
        description="marks label key stops; onChangeEnd fires once when the drag ends."
      >
        <Stack gap={2} width={FIELD_WIDTH}>
          <Slider
            label="Delivery window"
            value={days}
            onChange={setDays}
            onChangeEnd={setCommitted}
            min={1}
            max={30}
            marks={DAY_MARKS}
            valueDisplay="text"
            formatValue={(v) => `${v} days`}
          />
          <Caption>Committed: {committed} days (updates on release)</Caption>
        </Stack>
      </Preview>

      <Preview
        align="start"
        label="Range"
        description="Two thumbs for a min and max — with a minimum gap between them."
      >
        <Stack gap={2} width={FIELD_WIDTH}>
          <Slider
            label="Budget"
            value={range}
            onChange={setRange}
            min={BUDGET_MIN}
            max={BUDGET_MAX}
            step={BUDGET_STEP}
            minStepsBetweenThumbs={2}
            valueDisplay="text"
            formatValue={usd}
          />
        </Stack>
      </Preview>

      <Preview label="Filter by budget" description="A range slider driving a live result list.">
        <Card maxWidth={440}>
          <Stack gap={3}>
            <HStack hAlign="between" vAlign="center">
              <Heading level={4}>Rooms</Heading>
              <Badge label={`${matches.length} match`} variant="info" />
            </HStack>
            <Slider
              label="Budget"
              isLabelHidden
              value={range}
              onChange={setRange}
              min={BUDGET_MIN}
              max={BUDGET_MAX}
              step={BUDGET_STEP}
              formatValue={usd}
            />
            <Text type="supporting" color="secondary">
              {usd(range[0])} – {usd(range[1])}
            </Text>
            <Stack gap={1}>
              {matches.length ? (
                matches.map((r) => (
                  <HStack key={r.title} hAlign="between">
                    <Text>{r.title}</Text>
                    <Text color="secondary" hasTabularNumbers>
                      {usd(r.budget)}
                    </Text>
                  </HStack>
                ))
              ) : (
                <Caption>No rooms in this range.</Caption>
              )}
            </Stack>
          </Stack>
        </Card>
      </Preview>

      <Preview
        align="start"
        label="Vertical"
        description='orientation="vertical" for mixers and compact panels.'
      >
        <HStack gap={6} height={200}>
          {EQ.map((band, index) => (
            <Slider
              key={band}
              label={band}
              orientation="vertical"
              min={-12}
              max={12}
              value={eq[index]}
              onChange={(v: number) =>
                setEq((current: number[]) => current.map((value, i) => (i === index ? v : value)))
              }
              formatValue={(v) => `${v > 0 ? "+" : ""}${v} dB`}
            />
          ))}
        </HStack>
      </Preview>

      <Preview
        align="start"
        label="Status and help"
        description="Description, status, and a tooltip on the label."
      >
        <Stack width={FIELD_WIDTH}>
          <Slider
            label="Confidence"
            description="How sure are you about the timeline?"
            labelTooltip="Owners see this beside your bid."
            value={confidence}
            onChange={setConfidence}
            valueDisplay="text"
            formatValue={(v) => `${v}%`}
            status={
              confidence < 40
                ? { type: "warning", message: "Low confidence bids are ranked lower." }
                : undefined
            }
          />
        </Stack>
      </Preview>

      <Preview align="start" label="Disabled">
        <Stack width={FIELD_WIDTH}>
          <Slider
            label="Seats"
            value={5}
            min={1}
            max={20}
            isDisabled
            disabledMessage="Seat count is fixed on your plan."
          />
        </Stack>
      </Preview>

      <Preview
        align="start"
        label="With icons"
        description="Icons at either end hint at the scale."
      >
        <HStack gap={2} vAlign="center" width={FIELD_WIDTH}>
          <Icon icon={icons.minus} color="secondary" size="sm" />
          <Stack width="100%">
            <Slider label="Zoom" isLabelHidden value={volume} onChange={setVolume} />
          </Stack>
          <Icon icon={icons.plus} color="secondary" size="sm" />
        </HStack>
      </Preview>
    </Examples>
  );
}
