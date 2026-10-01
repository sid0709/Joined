"use client";

import { useState } from "react";
import {
  DateField,
  FormLayout,
  Grid,
  SegmentedControl,
  SegmentedControlItem,
  Selector,
  Stack,
  Text,
  TextInput,
  TimeField,
} from "@joined/design-system";
import { FormDialog } from "@/components/form-dialog";
import { type Application } from "@/lib/applications";
import { FORMAT_LABEL, type InterviewFormat } from "@/lib/interviews";

const FORMATS = Object.keys(FORMAT_LABEL) as InterviewFormat[];
const DURATIONS = [30, 45, 60, 90, 120];
const DEFAULT_DURATION = 45;
const DEFAULT_START = "10:00";
const MINUTES_PER_HOUR = 60;
const FIELD_MIN_WIDTH = 160;

function addMinutes(time: string, minutes: number) {
  const [hours, mins] = time.split(":").map(Number);
  const total = hours * MINUTES_PER_HOUR + mins + minutes;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(Math.floor(total / MINUTES_PER_HOUR) % 24)}:${pad(total % MINUTES_PER_HOUR)}`;
}

/** Log an interview by hand, tied to one of your applications. */
export function AddInterviewDialog({
  isOpen,
  onOpenChange,
  defaultDate,
  applications,
  onAdd,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  defaultDate: Date;
  applications: Application[];
  onAdd: (input: {
    applicationId: string;
    round: string;
    date: Date;
    start: string;
    end: string;
    format: InterviewFormat;
    where: string;
  }) => Promise<void> | void;
}) {
  const options = applications
    .filter((app) => app.columnId !== "closed" && app.columnId !== "saved")
    .map((app) => ({ value: app.id, label: `${app.title} · ${app.company}` }));
  const [applicationId, setApplicationId] = useState(options[0]?.value ?? "");
  const [round, setRound] = useState("");
  const [date, setDate] = useState<Date | null>(defaultDate);
  const [start, setStart] = useState(DEFAULT_START);
  const [duration, setDuration] = useState(String(DEFAULT_DURATION));
  const [format, setFormat] = useState<InterviewFormat>("video");
  const [where, setWhere] = useState("");

  const submit = async () => {
    if (!applicationId || !date) return;
    await onAdd({
      applicationId,
      round: round.trim(),
      date,
      start,
      end: addMinutes(start, Number(duration)),
      format,
      where: where.trim() || FORMAT_LABEL[format],
    });
    setRound("");
    setWhere("");
    onOpenChange(false);
  };

  return (
    <FormDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Add an interview"
      subtitle="We’ll remind you the day before."
      submitLabel="Add interview"
      onSubmit={submit}
      isSubmitDisabled={!applicationId || !round.trim() || !date}
    >
      <FormLayout>
        <Selector
          label="Application"
          options={options}
          value={applicationId}
          onChange={setApplicationId}
        />
        <TextInput
          label="Round"
          value={round}
          onChange={setRound}
          isRequired
          placeholder="Round 1 · Hiring manager"
        />
        <Grid columns={{ minWidth: FIELD_MIN_WIDTH, repeat: "fit" }} gap={3}>
          <Stack gap={2}>
            <Text type="label">Date</Text>
            <DateField value={date} onChange={setDate} label="Date" />
          </Stack>
          <Stack gap={2}>
            <Text type="label">Start</Text>
            <TimeField value={start} onChange={setStart} label="Start time" picker="columns" />
          </Stack>
        </Grid>
        <Selector
          label="Length"
          options={DURATIONS.map((minutes) => ({
            value: String(minutes),
            label: `${minutes} minutes`,
          }))}
          value={duration}
          onChange={setDuration}
        />
        <Stack gap={2}>
          <Text type="label">Format</Text>
          <SegmentedControl
            label="Format"
            value={format}
            onChange={(value) => setFormat(value as InterviewFormat)}
            layout="fill"
          >
            {FORMATS.map((value) => (
              <SegmentedControlItem key={value} value={value} label={FORMAT_LABEL[value]} />
            ))}
          </SegmentedControl>
        </Stack>
        <TextInput label="Link, phone, or address" value={where} onChange={setWhere} isOptional />
      </FormLayout>
    </FormDialog>
  );
}
