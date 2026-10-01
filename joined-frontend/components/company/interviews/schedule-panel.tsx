"use client";

import { useMemo } from "react";
import {
  Banner,
  Button,
  Heading,
  HStack,
  SegmentedControl,
  SegmentedControlItem,
  Stack,
  Text,
  TextInput,
  Token,
} from "@joined/design-system";
import { InterviewerAssign } from "@/components/company/pipeline/interviewer-assign";
import { SelfScheduleShare } from "@/components/company/interviews/self-schedule-share";
import type { HiringProfile, TeamMember } from "@/lib/company";
import {
  MAX_PROPOSED_SLOTS,
  proposeSlotsFromAvailability,
  slotLabel,
  type ProposedSlot,
  type ScheduleMode,
} from "@/lib/schedule-join";
import { formatDay, parseISODate } from "@/lib/dates";

export type ScheduleDraft = {
  date: string;
  start: string;
  end: string;
  round: string;
  mode: ScheduleMode;
  proposedSlots: ProposedSlot[];
  interviewerIds: string[];
};

const MODE_ITEMS: { value: ScheduleMode; label: string }[] = [
  { value: "fixed", label: "Pick a time" },
  { value: "propose", label: "Propose slots" },
  { value: "self_schedule", label: "Self-schedule" },
];

/** Schedule UX: interviewers, availability slots, or self-schedule share. */
export function SchedulePanel({
  hiringProfile,
  teamMembers,
  interviewerIds,
  onInterviewersChange,
  draft,
  onDraftChange,
}: {
  hiringProfile: HiringProfile | null;
  teamMembers: TeamMember[];
  interviewerIds: string[];
  onInterviewersChange: (ids: string[]) => void;
  draft: ScheduleDraft;
  onDraftChange: (next: ScheduleDraft) => void;
}) {
  const suggested = useMemo(
    () =>
      hiringProfile
        ? proposeSlotsFromAvailability(hiringProfile, { count: MAX_PROPOSED_SLOTS })
        : [],
    [hiringProfile],
  );

  const set = <K extends keyof ScheduleDraft>(key: K, value: ScheduleDraft[K]) =>
    onDraftChange({ ...draft, [key]: value });

  const toggleProposed = (slot: ProposedSlot) => {
    const key = slotLabel(slot);
    const exists = draft.proposedSlots.some((item) => slotLabel(item) === key);
    const next = exists
      ? draft.proposedSlots.filter((item) => slotLabel(item) !== key)
      : [...draft.proposedSlots, slot].slice(0, MAX_PROPOSED_SLOTS);
    onDraftChange({
      ...draft,
      proposedSlots: next,
      // Keep fixed fields in sync with the first selected slot for API POST.
      ...(next[0] ? { date: next[0].date, start: next[0].start, end: next[0].end } : {}),
    });
  };

  const applySuggested = (slot: ProposedSlot) => {
    onDraftChange({
      ...draft,
      mode: "fixed",
      date: slot.date,
      start: slot.start,
      end: slot.end,
    });
  };

  return (
    <Stack gap={3}>
      <Heading level={3}>Schedule</Heading>
      <Text type="supporting" color="secondary">
        The interview price is taken from your balance now and returned if they don’t attend.
      </Text>

      <SegmentedControl
        label="How to schedule"
        value={draft.mode}
        onChange={(value) => set("mode", value as ScheduleMode)}
      >
        {MODE_ITEMS.map((item) => (
          <SegmentedControlItem key={item.value} value={item.value} label={item.label} />
        ))}
      </SegmentedControl>

      <InterviewerAssign
        members={teamMembers}
        value={interviewerIds}
        onChange={onInterviewersChange}
      />

      {draft.mode === "fixed" ? (
        <Stack gap={3}>
          {suggested.length > 0 ? (
            <Stack gap={2}>
              <Text type="label">From your availability</Text>
              <Text type="supporting" color="secondary">
                Based on your hiring profile days and hours
                {hiringProfile?.meetingLink ? " · meeting link ready" : ""}.
              </Text>
              <HStack gap={2} wrap="wrap">
                {suggested.map((slot) => (
                  <Button
                    key={slotLabel(slot)}
                    label={`${formatDay(parseISODate(slot.date))} ${slot.start}`}
                    variant={
                      draft.date === slot.date && draft.start === slot.start
                        ? "primary"
                        : "secondary"
                    }
                    size="sm"
                    onClick={() => applySuggested(slot)}
                  />
                ))}
              </HStack>
            </Stack>
          ) : (
            <Banner
              status="info"
              title="No availability yet"
              description="Set interview days and hours on your hiring profile to get suggested slots here."
            />
          )}
          <TextInput
            label="Date"
            value={draft.date}
            onChange={(date) => set("date", date)}
            placeholder="YYYY-MM-DD"
          />
          <HStack gap={3}>
            <TextInput
              label="Start"
              value={draft.start}
              onChange={(start) => set("start", start)}
              placeholder="10:00"
            />
            <TextInput
              label="End"
              value={draft.end}
              onChange={(end) => set("end", end)}
              placeholder="10:45"
            />
          </HStack>
          <TextInput label="Round" value={draft.round} onChange={(round) => set("round", round)} />
        </Stack>
      ) : null}

      {draft.mode === "propose" ? (
        <Stack gap={3}>
          <Text type="supporting" color="secondary">
            Offer up to {MAX_PROPOSED_SLOTS} times. The round stays awaiting until the candidate (or
            you) locks one of these slots.
          </Text>
          {suggested.length === 0 ? (
            <Banner
              status="info"
              title="No slots from availability"
              description="Add interview days and hours on your hiring profile, or enter a fixed time instead."
            />
          ) : (
            <HStack gap={2} wrap="wrap">
              {suggested.map((slot) => {
                const selected = draft.proposedSlots.some(
                  (item) => slotLabel(item) === slotLabel(slot),
                );
                return (
                  <Button
                    key={slotLabel(slot)}
                    label={`${formatDay(parseISODate(slot.date))} ${slot.start}`}
                    variant={selected ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => toggleProposed(slot)}
                  />
                );
              })}
            </HStack>
          )}
          {draft.proposedSlots.length > 0 ? (
            <HStack gap={2} wrap="wrap">
              {draft.proposedSlots.map((slot) => (
                <Token key={slotLabel(slot)} label={slotLabel(slot)} size="sm" />
              ))}
            </HStack>
          ) : null}
          <TextInput label="Round" value={draft.round} onChange={(round) => set("round", round)} />
        </Stack>
      ) : null}

      {draft.mode === "self_schedule" ? (
        <Stack gap={3}>
          <SelfScheduleShare />
          <Text type="supporting" color="secondary">
            Creates an awaiting round and mints a self-schedule link you can copy and share after
            scheduling. The candidate picks a time; you can also lock a slot later from Interviews.
          </Text>
          <TextInput label="Round" value={draft.round} onChange={(round) => set("round", round)} />
        </Stack>
      ) : null}
    </Stack>
  );
}

export function emptyScheduleDraft(): ScheduleDraft {
  return {
    date: "",
    start: "10:00",
    end: "10:45",
    round: "Round 1",
    mode: "fixed",
    proposedSlots: [],
    interviewerIds: [],
  };
}

/** Whether the primary Schedule CTA can fire against the company interview API. */
export function scheduleDraftReady(draft: ScheduleDraft): boolean {
  if (draft.mode === "fixed") {
    return /^\d{4}-\d{2}-\d{2}$/.test(draft.date) && /^\d{2}:\d{2}$/.test(draft.start);
  }
  if (draft.mode === "propose") {
    return draft.proposedSlots.length > 0;
  }
  // Self-schedule posts an awaiting round; BE mints selfScheduleUrl for share/copy.
  return draft.round.trim().length > 0;
}
