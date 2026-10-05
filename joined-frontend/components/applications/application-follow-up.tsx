"use client";

import { useState } from "react";
import {
  Button,
  DateField,
  FormLayout,
  Grid,
  Heading,
  HStack,
  Stack,
  Text,
  TextArea,
  TimeField,
} from "@joined/design-system";
import { MAX_APPLICATION_NOTES, type Application } from "@/lib/applications";
import {
  combineDateAndTime,
  DEFAULT_REMIND_TIME,
  reminderLabel,
  timeFromDate,
} from "@/lib/application-reminders";

const NOTE_ROWS = 4;
const FIELD_MIN_WIDTH = 160;

export type ApplicationFollowUpPatch = {
  notes?: string;
  remindAt?: Date | null;
};

/** Private notes and a follow-up reminder for one tracker card. */
export function ApplicationFollowUp({
  application,
  onSave,
}: {
  application: Application;
  onSave: (patch: ApplicationFollowUpPatch) => void;
}) {
  const savedNotes = application.notes ?? "";
  const [notes, setNotes] = useState(savedNotes);
  const [time, setTime] = useState(
    application.remindAt ? timeFromDate(application.remindAt) : DEFAULT_REMIND_TIME,
  );
  const [seenId, setSeenId] = useState(application.id);
  const remindStamp = application.remindAt?.toISOString() ?? "";
  const [seenRemind, setSeenRemind] = useState(remindStamp);
  if (seenId !== application.id) {
    setSeenId(application.id);
    setNotes(application.notes ?? "");
    setTime(application.remindAt ? timeFromDate(application.remindAt) : DEFAULT_REMIND_TIME);
    setSeenRemind(remindStamp);
  } else if (seenRemind !== remindStamp) {
    setSeenRemind(remindStamp);
    setTime(application.remindAt ? timeFromDate(application.remindAt) : DEFAULT_REMIND_TIME);
  }

  const notesDirty = notes !== savedNotes;

  const persistNotes = () => {
    if (!notesDirty) return;
    onSave({ notes });
  };

  const persistReminder = (next: Date | null) => {
    onSave({ remindAt: next });
  };

  return (
    <Stack gap={6}>
      <Stack gap={3}>
        <Heading level={3}>Notes</Heading>
        <TextArea
          label="Private notes"
          description="Only you can see these."
          value={notes}
          onChange={setNotes}
          onBlur={persistNotes}
          rows={NOTE_ROWS}
          maxLength={MAX_APPLICATION_NOTES}
          placeholder="Who you spoke with, what they asked, what to follow up on…"
        />
        <HStack hAlign="end">
          <Button
            label="Save notes"
            variant="secondary"
            size="sm"
            isDisabled={!notesDirty}
            onClick={persistNotes}
          />
        </HStack>
      </Stack>

      <Stack gap={3}>
        <Heading level={3}>Reminder</Heading>
        <FormLayout>
          <Grid columns={{ minWidth: FIELD_MIN_WIDTH, repeat: "fit" }} gap={3}>
            <Stack gap={2}>
              <Text type="label">Remind on</Text>
              <DateField
                value={application.remindAt ?? null}
                onChange={(date) => persistReminder(combineDateAndTime(date, time))}
                label="Remind on"
              />
            </Stack>
            <Stack gap={2}>
              <Text type="label">Time</Text>
              <TimeField
                value={time}
                onChange={(next) => {
                  setTime(next);
                  if (!application.remindAt) return;
                  persistReminder(combineDateAndTime(application.remindAt, next));
                }}
                label="Time"
                picker="columns"
              />
            </Stack>
          </Grid>
        </FormLayout>
        {application.remindAt ? (
          <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
            <Text type="supporting" color="secondary">
              {reminderLabel(application.remindAt)}
            </Text>
            <Button
              label="Clear reminder"
              variant="ghost"
              size="sm"
              onClick={() => persistReminder(null)}
            />
          </HStack>
        ) : (
          <Text type="supporting" color="secondary">
            We’ll flag this card when the reminder is due.
          </Text>
        )}
      </Stack>
    </Stack>
  );
}
