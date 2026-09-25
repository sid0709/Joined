"use client";

import { useState } from "react";
import { Badge, Card, Clock, Divider, HStack, Heading, Stack, Switch, Text, TimeInput, displayTime, type FieldSize } from "@openseat/design-system";
import { Caption, Examples, Preview } from "./shared";

const SIZES: FieldSize[] = ["sm", "md", "lg"];
const WORLD = [
  { zone: "America/Los_Angeles", city: "San Francisco" },
  { zone: "Europe/London", city: "London" },
  { zone: "Asia/Tokyo", city: "Tokyo" },
];
const BOOKED = ["10:00", "11:30", "14:00", "14:30"];
const MINUTES_PER_HOUR = 60;
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function minutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * MINUTES_PER_HOUR + m;
}

function duration(start: string, end: string) {
  const total = minutes(end) - minutes(start);
  const h = Math.floor(total / MINUTES_PER_HOUR);
  const m = total % MINUTES_PER_HOUR;
  return [h && `${h} h`, m && `${m} min`].filter(Boolean).join(" ");
}

type Hours = { open: boolean; from: string; to: string };

export default function TimeInputDemo() {
  const [shared, setShared] = useState("09:30");
  const [dial, setDial] = useState("21:15");
  const [slot, setSlot] = useState("15:00");
  const [precise, setPrecise] = useState("14:05:30");
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("11:30");
  const [week, setWeek] = useState<Record<string, Hours>>(() =>
    Object.fromEntries(WEEKDAYS.map((day, index) => [day, { open: index < 5, from: "09:00", to: index === 4 ? "15:00" : "17:00" }])),
  );
  const [sizes, setSizes] = useState<Record<FieldSize, string>>({ sm: "08:00", md: "12:30", lg: "18:45" });

  return (
    <Examples>
      <Preview label="One value, five ways in — change any of them">
        <Stack gap={5}>
          <HStack gap={6} wrap="wrap" vAlign="start">
            <TimeInput label="Type or pick" value={shared} onChange={setShared} description="Type digits, use ↑ ↓, or open the list." />
            <TimeInput label="Dropdowns" value={shared} onChange={setShared} variant="select" />
          </HStack>
          <HStack gap={6} wrap="wrap" vAlign="start">
            <TimeInput label="Dial — tap or drag" value={shared} onChange={setShared} variant="dial" />
            <TimeInput label="Wheels" value={shared} onChange={setShared} variant="columns" />
          </HStack>
          <Caption>Current value: {shared} · {displayTime(shared, "12h")}</Caption>
        </Stack>
      </Preview>

      <Preview label="Field with a dial or a slot list in the dropdown">
        <HStack gap={6} wrap="wrap" vAlign="start">
          <TimeInput label="Reminder" value={dial} onChange={setDial} picker="dial" hourCycle="24h" description="24-hour — inner ring is 00 and 13–23." />
          <TimeInput
            label="Interview"
            value={slot}
            onChange={setSlot}
            picker="slots"
            slots={{ start: "09:00", end: "17:00", interval: 30, unavailable: BOOKED }}
          />
        </HStack>
      </Preview>

      <Preview label="Booking slots — taken times are struck through">
        <TimeInput
          label="Pick a time"
          value={slot}
          onChange={setSlot}
          variant="slots"
          slots={{ start: "09:00", end: "19:00", interval: 30, unavailable: BOOKED, grouped: true }}
        />
      </Preview>

      <Preview label="Seconds, sizes, and states">
        <Stack gap={5}>
          <HStack gap={6} wrap="wrap" vAlign="start">
            <TimeInput label="Timestamp" value={precise} onChange={setPrecise} hourCycle="24h" withSeconds />
            <TimeInput label="Every 15 minutes" value={shared} onChange={setShared} minuteStep={15} />
          </HStack>
          <HStack gap={6} wrap="wrap" vAlign="end">
            {SIZES.map((size) => (
              <TimeInput key={size} size={size} label={size} value={sizes[size]} onChange={(value) => setSizes((c) => ({ ...c, [size]: value }))} />
            ))}
          </HStack>
          <HStack gap={6} wrap="wrap" vAlign="start">
            <TimeInput label="Locked" value="08:00" disabled />
            <TimeInput label="End" value="08:00" error helper="End must be after the start." />
          </HStack>
        </Stack>
      </Preview>

      <Preview label="Clock — show a time without asking for one">
        <Stack gap={6}>
          <HStack gap={8} wrap="wrap" vAlign="center">
            {WORLD.map((place) => (
              <Clock key={place.zone} timeZone={place.zone} label={place.city} />
            ))}
          </HStack>
          <HStack gap={6} wrap="wrap" vAlign="center">
            <Clock variant="minimal" size="lg" value={shared} showSeconds={false} />
            <Clock variant="digital" label="Local time" />
            <Clock variant="digital" size="sm" hourCycle="24h" value={precise} />
          </HStack>
          <HStack gap={3} wrap="wrap" vAlign="center">
            {WORLD.map((place) => (
              <Clock key={place.zone} variant="compact" timeZone={place.zone} label={place.city} />
            ))}
          </HStack>
        </Stack>
      </Preview>

      <Preview label="Meeting planner — start, end, and a live duration">
        <Card maxWidth={440}>
          <Stack gap={3}>
            <Heading level={4}>Kickoff call</Heading>
            <HStack gap={4} wrap="wrap" vAlign="start">
              <TimeInput label="Starts" value={start} onChange={setStart} minuteStep={15} size="sm" />
              <TimeInput
                label="Ends"
                value={end}
                onChange={setEnd}
                minuteStep={15}
                size="sm"
                error={minutes(end) <= minutes(start)}
                helper={minutes(end) <= minutes(start) ? "End after the start." : undefined}
              />
            </HStack>
            <HStack gap={2} vAlign="center">
              {minutes(end) > minutes(start) ? <Badge label={duration(start, end)} variant="info" /> : <Badge label="Invalid" variant="error" />}
              <Caption>
                {displayTime(start, "12h")} – {displayTime(end, "12h")}
              </Caption>
            </HStack>
          </Stack>
        </Card>
      </Preview>

      <Preview label="Opening hours — a row per weekday">
        <Card maxWidth={560}>
          <Stack gap={2}>
            {WEEKDAYS.map((day, index) => {
              const hours = week[day];
              const set = (patch: Partial<Hours>) => setWeek((w) => ({ ...w, [day]: { ...w[day], ...patch } }));
              return (
                <Stack key={day} gap={2}>
                  {index > 0 && <Divider />}
                  <HStack gap={4} vAlign="center" wrap="wrap">
                    <Stack width={140}>
                      <Switch label={day} value={hours.open} onChange={(open) => set({ open })} size="sm" />
                    </Stack>
                    {hours.open ? (
                      <HStack gap={2} vAlign="center">
                        <TimeInput label={`${day} opens`} value={hours.from} onChange={(from) => set({ from })} size="sm" minuteStep={30} />
                        <Text color="secondary">to</Text>
                        <TimeInput label={`${day} closes`} value={hours.to} onChange={(to) => set({ to })} size="sm" minuteStep={30} />
                      </HStack>
                    ) : (
                      <Text color="secondary">Closed</Text>
                    )}
                  </HStack>
                </Stack>
              );
            })}
          </Stack>
        </Card>
      </Preview>
    </Examples>
  );
}
