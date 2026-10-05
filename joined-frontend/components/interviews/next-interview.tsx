"use client";

import {
  Avatar,
  AvatarGroup,
  Badge,
  Button,
  Card,
  EmptyState,
  GridColumn,
  GridSystem,
  HStack,
  Heading,
  Icon,
  Stack,
  StatusDot,
  Text,
  icons,
} from "sid-ui";
import { DateBadge } from "@/components/date-badge";
import { daysBetween, formatDay, formatTime, relativeDay } from "@/lib/dates";
import { FORMAT_LABEL, STATUS_META, type Interview, type PrepTask } from "@/lib/interviews";
import { PrepChecklist } from "./prep-checklist";

const AVATAR_SIZE = 32;
/** Pulse the status dot when the interview is this close. */
const SOON_DAYS = 1;

/** The very next interview, with everything needed to walk in ready. */
export function NextInterview({
  interview,
  onPrepChange,
  onOpen,
  onAdd,
}: {
  interview: Interview | undefined;
  onPrepChange: (id: string, tasks: PrepTask[]) => void;
  onOpen: (id: string) => void;
  onAdd: () => void;
}) {
  if (!interview) {
    return (
      <Card padding={6}>
        <EmptyState
          title="No interviews coming up"
          description="When a company schedules a round, it shows up here with a prep checklist."
          actions={<Button label="Add an interview" variant="secondary" onClick={onAdd} />}
        />
      </Card>
    );
  }

  const soon = daysBetween(new Date(), interview.date) <= SOON_DAYS;
  const status = STATUS_META[interview.status];

  return (
    <Card padding={6} elevation="low">
      <GridSystem gap={6}>
        <GridColumn span="full" md={7}>
          <Stack gap={5}>
            <HStack gap={2} vAlign="center" wrap="wrap">
              <StatusDot variant={soon ? "warning" : "accent"} label="Next up" isPulsing={soon} />
              <Text type="label" color="accent">
                Next up · {relativeDay(interview.date)}
              </Text>
              {interview.status !== "scheduled" ? (
                <Badge label={status.label} variant={status.badge} />
              ) : null}
            </HStack>

            <HStack gap={4} vAlign="start">
              <DateBadge date={interview.date} />
              <Stack gap={1}>
                <Heading level={2}>{interview.role}</Heading>
                <Text color="secondary" display="block">
                  {interview.company} · {interview.round}
                </Text>
                <Text weight="medium" display="block">
                  {formatDay(interview.date)} · {formatTime(interview.start)} –{" "}
                  {formatTime(interview.end)}
                </Text>
              </Stack>
            </HStack>

            <HStack gap={2} wrap="wrap">
              <Badge label={FORMAT_LABEL[interview.format]} variant="neutral" />
              <Badge label={interview.where} variant="neutral" />
            </HStack>

            <HStack gap={3} vAlign="center">
              <AvatarGroup size={AVATAR_SIZE}>
                {interview.interviewers.map((person) => (
                  <Avatar key={person.name} name={person.name} />
                ))}
              </AvatarGroup>
              <Text type="supporting" color="secondary">
                With {interview.interviewers.map((person) => person.name).join(", ")}
              </Text>
            </HStack>

            <HStack gap={2} wrap="wrap">
              {interview.format === "video" ? (
                <Button label="Join call" variant="primary" icon={<Icon icon={icons.play} />} />
              ) : null}
              <Button label="Details" variant="secondary" onClick={() => onOpen(interview.id)} />
              <Button
                label="Add to calendar"
                variant="ghost"
                icon={<Icon icon={icons.calendar} />}
              />
            </HStack>
          </Stack>
        </GridColumn>
        <GridColumn span="full" md={5}>
          <Card variant="muted" padding={5}>
            <PrepChecklist
              tasks={interview.prep}
              onChange={(tasks) => onPrepChange(interview.id, tasks)}
            />
          </Card>
        </GridColumn>
      </GridSystem>
    </Card>
  );
}
