"use client";

import { useState } from "react";
import { Banner, Button, Heading, HStack, Stack, Text, TextInput, useToast } from "sid-ui";
import { formatDay, formatTime, parseISODate } from "@/lib/dates";
import { FORMAT_LABEL, type InterviewFormat } from "@/lib/interviews";
import { isConflictError } from "@/lib/me/client";
import { acceptPublicSchedule, isGoneError, type PublicSchedule } from "@/lib/schedule-public";
import { slotLabel, type ProposedSlot } from "@/lib/schedule-join";

function formatLabel(format: string) {
  if (format === "video" || format === "phone" || format === "onsite") {
    return FORMAT_LABEL[format as InterviewFormat];
  }
  return format;
}

function expiryLabel(expiresAt: string | undefined) {
  if (!expiresAt) return null;
  const when = new Date(expiresAt);
  if (Number.isNaN(when.getTime())) return null;
  return formatDay(when);
}

/** Candidate picks one offered slot (or enters a time) and locks awaiting → scheduled. */
export function PublicSchedulePicker({
  scheduleKey,
  initial,
}: {
  scheduleKey: string;
  initial: PublicSchedule;
}) {
  const toast = useToast();
  const [schedule, setSchedule] = useState(initial);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [custom, setCustom] = useState<ProposedSlot>({
    date: "",
    start: "10:00",
    end: "10:45",
  });

  const isAwaiting = schedule.status === "awaiting";
  const isScheduled = schedule.status === "scheduled";
  const slots = schedule.proposedSlots;
  const expiry = expiryLabel(schedule.expiresAt);

  const lock = (slot: ProposedSlot) => {
    const key = slotLabel(slot);
    setBusyKey(key);
    acceptPublicSchedule(scheduleKey, slot)
      .then((next) => {
        setSchedule(next);
        toast({ body: "Interview time confirmed." });
      })
      .catch((error: unknown) => {
        if (isGoneError(error)) {
          toast({ body: error.message || "This scheduling link has expired.", type: "error" });
          return;
        }
        if (isConflictError(error)) {
          toast({
            body: error.message || "This interview is no longer awaiting a time.",
            type: "error",
          });
          return;
        }
        toast({
          body: error instanceof Error ? error.message : "Could not lock that time.",
          type: "error",
        });
      })
      .finally(() => setBusyKey(null));
  };

  const customReady =
    /^\d{4}-\d{2}-\d{2}$/.test(custom.date) &&
    /^\d{2}:\d{2}$/.test(custom.start) &&
    /^\d{2}:\d{2}$/.test(custom.end);

  return (
    <Stack gap={6}>
      <Stack gap={2}>
        <Heading level={1}>Pick a time for your interview</Heading>
        <Text type="supporting" color="secondary">
          {schedule.company} · {schedule.role} · {schedule.round} · {formatLabel(schedule.format)}
        </Text>
        {schedule.where ? (
          <Text type="supporting" color="secondary">
            {schedule.where}
          </Text>
        ) : null}
        {expiry && isAwaiting ? (
          <Text type="supporting" color="secondary">
            Link expires {expiry}.
          </Text>
        ) : null}
      </Stack>

      {isScheduled ? (
        <Banner
          status="success"
          title="You're scheduled"
          description={
            schedule.date && schedule.start && schedule.end
              ? `${formatDay(parseISODate(schedule.date))}, ${formatTime(schedule.start)} – ${formatTime(schedule.end)}. The hiring team has this time locked.`
              : "This interview time is locked. Check your email or Interviews for join details."
          }
        />
      ) : null}

      {!isAwaiting && !isScheduled ? (
        <Banner
          status="warning"
          title="This link is no longer open"
          description="The interview is not awaiting a time pick. Ask the hiring team if you need a new link."
        />
      ) : null}

      {isAwaiting ? (
        <Stack gap={4}>
          {slots.length > 0 ? (
            <Stack gap={3}>
              <Heading level={2}>Offered times</Heading>
              <Text type="supporting" color="secondary">
                Choose one time below. Confirming locks it for both of you.
              </Text>
              <Stack gap={2}>
                {slots.map((slot) => {
                  const key = slotLabel(slot);
                  return (
                    <HStack key={key} gap={2} vAlign="center" hAlign="between" wrap="wrap">
                      <Text weight="medium">
                        {formatDay(parseISODate(slot.date))} · {formatTime(slot.start)} –{" "}
                        {formatTime(slot.end)}
                      </Text>
                      <Button
                        label="Confirm this time"
                        variant="primary"
                        size="sm"
                        isLoading={busyKey === key}
                        isDisabled={busyKey != null}
                        onClick={() => lock(slot)}
                      />
                    </HStack>
                  );
                })}
              </Stack>
            </Stack>
          ) : (
            <Stack gap={3}>
              <Banner
                status="info"
                title="No offered times yet"
                description="Enter a date and time that works for you. The hiring team will see the locked slot."
              />
              <TextInput
                label="Date"
                value={custom.date}
                onChange={(date) => setCustom((current) => ({ ...current, date }))}
                placeholder="YYYY-MM-DD"
              />
              <HStack gap={3}>
                <TextInput
                  label="Start"
                  value={custom.start}
                  onChange={(start) => setCustom((current) => ({ ...current, start }))}
                  placeholder="10:00"
                />
                <TextInput
                  label="End"
                  value={custom.end}
                  onChange={(end) => setCustom((current) => ({ ...current, end }))}
                  placeholder="10:45"
                />
              </HStack>
              <Button
                label="Confirm this time"
                variant="primary"
                isLoading={busyKey === slotLabel(custom)}
                isDisabled={!customReady || busyKey != null}
                onClick={() => lock(custom)}
              />
            </Stack>
          )}
        </Stack>
      ) : null}

      {schedule.meetingUrl && isScheduled ? (
        <Text type="supporting" color="secondary">
          Join link: {schedule.meetingUrl}
        </Text>
      ) : null}
    </Stack>
  );
}
