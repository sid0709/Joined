"use client";

import { useState } from "react";
import {
  Button,
  Card,
  DateInput,
  DateRangeInput,
  DateTimeInput,
  HStack,
  Heading,
  Stack,
  Text,
  type DateInputFormat,
  type DateInputSize,
  type DateRangePreset,
  type DateRangeValue,
  type ISODateString,
  type ISODateTimeString,
} from "@openseat/design-system";
import { Caption, Examples, Preview } from "./shared";

const SIZES: DateInputSize[] = ["sm", "md", "lg"];
const FORMATS: DateInputFormat[] = ["date", "date_long", "date_weekday", "system_date"];
const FIELD_WIDTH = 280;
const DAY_MS = 86_400_000;
const MAX_STAY = 14;
const WEEKEND = [0, 6];

/** ISO yyyy-mm-dd for a day offset from today, in local time. */
function isoDay(offset = 0): ISODateString {
  const d = new Date(Date.now() + offset * DAY_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` as ISODateString;
}

/** ISO date-time at a given hh:mm on a day offset from today. */
function isoDayTime(offset: number, time: string) {
  return `${isoDay(offset)}T${time}` as ISODateTimeString;
}

const PRESETS: DateRangePreset[] = [
  { label: "Next 7 days", getRange: () => ({ start: isoDay(0), end: isoDay(6) }) },
  { label: "Next 14 days", getRange: () => ({ start: isoDay(0), end: isoDay(13) }) },
  { label: "Next 30 days", getRange: () => ({ start: isoDay(0), end: isoDay(29) }) },
];

export default function DateInputDemo() {
  const [sizes, setSizes] = useState<Record<DateInputSize, ISODateString | undefined>>({ sm: isoDay(), md: isoDay(), lg: isoDay() });
  const [deadline, setDeadline] = useState<ISODateString | undefined>(isoDay(7));
  const [kickoff, setKickoff] = useState<ISODateString | undefined>();
  const [formatted, setFormatted] = useState<ISODateString | undefined>(isoDay(3));
  const [trip, setTrip] = useState<DateRangeValue | null>({ start: isoDay(2), end: isoDay(6) });
  const [report, setReport] = useState<DateRangeValue | null>(null);
  const [meeting, setMeeting] = useState<ISODateTimeString | undefined>();
  const [closes, setCloses] = useState<ISODateTimeString | undefined>();
  const [tried, setTried] = useState(false);

  const nights = trip?.start && trip?.end ? Math.round((Date.parse(trip.end) - Date.parse(trip.start)) / DAY_MS) : 0;

  return (
    <Examples>
      <Preview align="start" label="Sizes" description="Type a date or open the calendar popover.">
        <Stack gap={3} width={FIELD_WIDTH}>
          {SIZES.map((size) => (
            <DateInput key={size} size={size} label={`Size ${size}`} value={sizes[size]} onChange={(v) => setSizes((c) => ({ ...c, [size]: v }))} />
          ))}
        </Stack>
      </Preview>

      <Preview align="start" label="Display formats" description="format changes how the chosen date reads — the value stays ISO.">
        <Stack gap={3} width={FIELD_WIDTH}>
          {FORMATS.map((format) => (
            <DateInput key={format} label={format} format={format} value={formatted} onChange={setFormatted} />
          ))}
          <Caption>Value: {formatted ?? "—"}</Caption>
        </Stack>
      </Preview>

      <Preview align="start" label="Limits" description="min and max bound the calendar; dateConstraints blocks specific days — here, weekends.">
        <Stack gap={3} width={FIELD_WIDTH}>
          <DateInput label="Room deadline" description="Between tomorrow and 60 days out." value={deadline} onChange={setDeadline} min={isoDay(1)} max={isoDay(60)} hasClear />
          <DateInput label="Kickoff (weekdays only)" value={kickoff} onChange={setKickoff} min={isoDay(0)} dateConstraints={[(d) => !WEEKEND.includes(d.getDay())]} placeholder="Pick a weekday" />
        </Stack>
      </Preview>

      <Preview align="start" label="Calendar options" description="Two months side by side, and weeks that start on Monday.">
        <Stack width={FIELD_WIDTH}>
          <DateInput label="Start date" value={deadline} onChange={setDeadline} numberOfMonths={2} weekStartsOn="mon" />
        </Stack>
      </Preview>

      <Preview align="start" label="Status and states">
        <Stack gap={3} width={FIELD_WIDTH}>
          <DateInput label="Invoice date" value={isoDay(-40)} onChange={() => undefined} status={{ type: "warning", message: "More than 30 days ago." }} />
          <DateInput label="Created" value={isoDay(-3)} isDisabled disabledMessage="Set when the room was made." />
        </Stack>
      </Preview>

      <Preview align="start" label="Date range" description="DateRangeInput picks a start and end, with presets and a span limit.">
        <Stack gap={3} width={FIELD_WIDTH + 80}>
          <DateRangeInput label="Stay" value={trip} onChange={setTrip} min={isoDay(0)} maxRangeSpan={MAX_STAY} numberOfMonths={2} description={`Up to ${MAX_STAY} nights.`} />
          <Caption>{trip?.end ? `${nights} nights` : "Pick an end date"}</Caption>
          <DateRangeInput label="Report period" value={report} onChange={setReport} presets={PRESETS} hasClear placeholder="Any time" />
        </Stack>
      </Preview>

      <Preview align="start" label="Date and time" description="DateTimeInput adds a time list — 12 or 24 hour, in set increments.">
        <Stack gap={3} width={FIELD_WIDTH + 80}>
          <DateTimeInput label="Kickoff call" value={meeting} onChange={setMeeting} hourFormat="12h" timeIncrement={15} min={isoDayTime(0, "09:00")} hasClear />
          <DateTimeInput label="Room closes (24h)" value={closes} onChange={setCloses} hourFormat="24h" timeOptionInterval={30} />
          <Caption>{meeting ? `Kickoff: ${meeting}` : "No kickoff scheduled."}</Caption>
        </Stack>
      </Preview>

      <Preview label="Schedule a room" description="Date inputs in a real form, validated on submit.">
        <Card maxWidth={440}>
          <Stack gap={3}>
            <Heading level={4}>When does bidding run?</Heading>
            <DateRangeInput
              label="Bidding window"
              isRequired
              value={report}
              onChange={setReport}
              presets={PRESETS}
              min={isoDay(0)}
              status={tried && !report ? { type: "error", message: "Choose when bidding opens and closes." } : undefined}
            />
            <DateInput label="Award by" isOptional value={kickoff} onChange={setKickoff} min={report?.end ?? isoDay(0)} />
            <HStack hAlign="end" gap={2}>
              <Text type="supporting" color="secondary">
                {report ? "Ready to publish" : ""}
              </Text>
              <Button label="Publish room" variant="primary" onClick={() => setTried(true)} />
            </HStack>
          </Stack>
        </Card>
      </Preview>
    </Examples>
  );
}
