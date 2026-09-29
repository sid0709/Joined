"use client";

import { useState } from "react";
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Drawer,
  HStack,
  Heading,
  MetadataList,
  MetadataListItem,
  ProgressBar,
  Rating,
  Selector,
  Stack,
  Text,
  TextArea,
  TextInput,
  Token,
} from "@openseat/design-system";
import {
  APPLICANT_STAGES,
  ASSISTED_LABEL,
  STRONG_FIT,
  type Applicant,
  type ApplicantStage,
} from "@/lib/company";
import { formatShortDate } from "@/lib/dates";
import { formatCount } from "@/lib/jobs";

const AVATAR_SIZE = 48;
const NOTE_ROWS = 3;
const STAGE_OPTIONS = APPLICANT_STAGES.map((stage) => ({ value: stage.id, label: stage.title }));

/** A candidate’s profile, the team’s read on them, and the next move. */
export function ApplicantDrawer({
  applicant,
  onClose,
  onChange,
  onSchedule,
}: {
  applicant: Applicant | null;
  onClose: () => void;
  onChange: (next: Applicant, message?: string) => void;
  onSchedule: (
    applicant: Applicant,
    slot: { date: string; start: string; end: string; round: string },
  ) => void;
}) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [date, setDate] = useState("");
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("10:45");
  const [round, setRound] = useState("Round 1");
  if (!applicant) return null;
  const move = (stage: ApplicantStage, message: string) =>
    onChange({ ...applicant, columnId: stage, notes: notes[applicant.id] }, message);
  const slotReady = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(start);

  return (
    <Drawer
      isOpen
      onOpenChange={(open) => (open ? null : onClose())}
      title={applicant.name}
      subtitle={applicant.headline}
      headerStart={<Avatar name={applicant.name} size={AVATAR_SIZE} tooltip={false} />}
      footer={
        <HStack gap={2} hAlign="between" wrap="wrap">
          <HStack gap={2}>
            <Button
              label="Reject"
              variant="ghost"
              onClick={() => move("rejected", `${applicant.name} rejected`)}
            />
            {applicant.assisted !== "direct" ? (
              <Button
                label="Not relevant"
                variant="ghost"
                onClick={() => move("rejected", "Marked not relevant — not billed")}
              />
            ) : null}
          </HStack>
          <HStack gap={2}>
            <Button
              label="Shortlist"
              variant="secondary"
              onClick={() => move("screening", `${applicant.name} shortlisted`)}
            />
            <Button
              label="Schedule interview"
              variant="primary"
              isDisabled={!slotReady}
              onClick={() => onSchedule(applicant, { date, start, end, round })}
            />
          </HStack>
        </HStack>
      }
    >
      <Stack gap={6}>
        <HStack gap={2} wrap="wrap">
          {applicant.verified ? (
            <Badge label="Verified identity" variant="blue" />
          ) : (
            <Badge label="Unverified" variant="warning" />
          )}
          <Badge
            label={ASSISTED_LABEL[applicant.assisted]}
            variant={applicant.assisted === "direct" ? "neutral" : "purple"}
          />
        </HStack>

        <Stack gap={2}>
          <HStack hAlign="between" vAlign="end">
            <Text type="label">Fit for {applicant.jobTitle}</Text>
            <Heading level={3} type="display-3">
              {`${applicant.fit}%`}
            </Heading>
          </HStack>
          <ProgressBar
            label="Fit"
            isLabelHidden
            value={applicant.fit}
            variant={applicant.fit >= STRONG_FIT ? "success" : "accent"}
          />
        </Stack>

        <MetadataList columns={2}>
          <MetadataListItem label="Experience">
            {formatCount(applicant.experienceYears, "year")}
          </MetadataListItem>
          <MetadataListItem label="Most recent">{applicant.lastCompany}</MetadataListItem>
          <MetadataListItem label="Location">{applicant.location}</MetadataListItem>
          <MetadataListItem label="Applied">
            {formatShortDate(applicant.appliedOn)}
          </MetadataListItem>
          <MetadataListItem label="Resume">{applicant.resume}</MetadataListItem>
        </MetadataList>

        <Stack gap={2}>
          <Text type="label">Skills</Text>
          <HStack gap={2} wrap="wrap">
            {applicant.skills.map((skill) => (
              <Token key={skill} label={skill} size="sm" />
            ))}
          </HStack>
        </Stack>

        <Banner
          status="info"
          title="Contact details stay hidden"
          description="Email and phone unlock once an interview is scheduled here."
        />

        <Stack gap={3}>
          <Heading level={3}>Schedule</Heading>
          <Text type="supporting" color="secondary">
            The interview price is taken from your balance now and returned if they don’t attend.
          </Text>
          <TextInput label="Date" value={date} onChange={setDate} placeholder="YYYY-MM-DD" />
          <HStack gap={3}>
            <TextInput label="Start" value={start} onChange={setStart} placeholder="10:00" />
            <TextInput label="End" value={end} onChange={setEnd} placeholder="10:45" />
          </HStack>
          <TextInput label="Round" value={round} onChange={setRound} />
        </Stack>

        <Stack gap={4}>
          <Heading level={3}>Team review</Heading>
          <Rating
            value={applicant.rating ?? 0}
            onChange={(rating) => onChange({ ...applicant, rating })}
            label="Your score"
          />
          <Selector
            label="Stage"
            options={STAGE_OPTIONS}
            value={applicant.columnId}
            onChange={(value) => onChange({ ...applicant, columnId: value as ApplicantStage })}
          />
          <TextArea
            label="Notes for the team"
            value={notes[applicant.id] ?? ""}
            onChange={(value) => setNotes((current) => ({ ...current, [applicant.id]: value }))}
            rows={NOTE_ROWS}
            placeholder="Strengths, concerns, what to probe in the interview…"
          />
        </Stack>
      </Stack>
    </Drawer>
  );
}
