"use client";

import {
  Avatar,
  Badge,
  Button,
  Drawer,
  HStack,
  Heading,
  MetadataList,
  MetadataListItem,
  Rating,
  Selector,
  Stack,
  Text,
  TextArea,
} from "@openseat/design-system";
import { formatDay, formatTime } from "@/lib/dates";
import {
  FORMAT_LABEL,
  OUTCOME_META,
  SOURCE_LABEL,
  STATUS_META,
  type Interview,
  type InterviewOutcome,
} from "@/lib/interviews";
import { PrepChecklist } from "./prep-checklist";

const LOGO_SIZE = 40;
const PERSON_SIZE = 32;
const NOTE_ROWS = 4;
const OUTCOME_OPTIONS = (Object.keys(OUTCOME_META) as InterviewOutcome[]).map((value) => ({
  value,
  label: OUTCOME_META[value].label,
}));

/** One interview in full: logistics, people, prep, and your notes afterwards. */
export function InterviewDrawer({
  interview,
  onClose,
  onChange,
}: {
  interview: Interview | null;
  onClose: () => void;
  onChange: (next: Interview) => void;
}) {
  if (!interview) return null;
  const status = STATUS_META[interview.status];
  const isPast = interview.status === "completed";
  const update = (patch: Partial<Interview>) => onChange({ ...interview, ...patch });

  return (
    <Drawer
      isOpen
      onOpenChange={(open) => (open ? null : onClose())}
      title={interview.role}
      subtitle={`${interview.company} · ${interview.round}`}
      headerStart={
        <Avatar name={interview.company} size={LOGO_SIZE} shape="rounded" tooltip={false} />
      }
      footer={
        <HStack gap={2} hAlign="between" wrap="wrap">
          {isPast || interview.status === "cancelled" ? (
            <span />
          ) : (
            <Button
              label="Cancel interview"
              variant="ghost"
              onClick={() => update({ status: "cancelled" })}
            />
          )}
          <HStack gap={2}>
            {interview.status === "unconfirmed" ? (
              <Button
                label="Confirm"
                variant="secondary"
                onClick={() => update({ status: "scheduled" })}
              />
            ) : null}
            <Button label="Done" variant="primary" onClick={onClose} />
          </HStack>
        </HStack>
      }
    >
      <Stack gap={6}>
        <HStack gap={2} wrap="wrap">
          <Badge label={status.label} variant={status.badge} />
          <Badge label={SOURCE_LABEL[interview.source]} variant="neutral" />
        </HStack>

        <MetadataList>
          <MetadataListItem label="When">
            {formatDay(interview.date)}, {formatTime(interview.start)} – {formatTime(interview.end)}
          </MetadataListItem>
          <MetadataListItem label="Format">{FORMAT_LABEL[interview.format]}</MetadataListItem>
          <MetadataListItem label="Where">{interview.where}</MetadataListItem>
        </MetadataList>

        <Stack gap={3}>
          <Heading level={3}>Interviewers</Heading>
          {interview.interviewers.map((person) => (
            <HStack key={person.name} gap={3} vAlign="center">
              <Avatar name={person.name} size={PERSON_SIZE} tooltip={false} />
              <Stack gap={0}>
                <Text weight="medium">{person.name}</Text>
                <Text type="supporting" color="secondary">
                  {person.title}
                </Text>
              </Stack>
            </HStack>
          ))}
        </Stack>

        {isPast ? (
          <Stack gap={4}>
            <Heading level={3}>How it went</Heading>
            <Rating
              value={interview.selfRating ?? 0}
              onChange={(selfRating) => update({ selfRating })}
              label="Your rating"
            />
            <Selector
              label="Outcome"
              options={OUTCOME_OPTIONS}
              value={interview.outcome ?? "waiting"}
              onChange={(value) => update({ outcome: value as InterviewOutcome })}
            />
          </Stack>
        ) : (
          <PrepChecklist tasks={interview.prep} onChange={(prep) => update({ prep })} />
        )}

        <TextArea
          label="Notes"
          description="Only you can see these."
          value={interview.notes ?? ""}
          onChange={(notes) => update({ notes })}
          rows={NOTE_ROWS}
          placeholder="Questions they asked, names, follow-ups…"
        />
      </Stack>
    </Drawer>
  );
}
