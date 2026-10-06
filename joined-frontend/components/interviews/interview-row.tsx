"use client";

import { Badge, ClickableCard, HStack, Heading, Stack, Text } from "sid-ui";
import { DateBadge } from "@/components/date-badge";
import { formatTime, relativeDay } from "@/lib/dates";
import { FORMAT_LABEL, STATUS_META, type Interview } from "@/lib/interviews";

/** One interview as a clickable row: date, role, time, and readiness. */
export function InterviewRow({ interview, onOpen }: { interview: Interview; onOpen: () => void }) {
  const status = STATUS_META[interview.status];
  const done = interview.prep.filter((task) => task.done).length;

  return (
    <ClickableCard label={`${interview.role} at ${interview.company}`} onClick={onOpen} padding={4}>
      <HStack gap={4} vAlign="center">
        <DateBadge date={interview.date} isMuted={interview.status === "completed"} />
        <Stack gap={1}>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Heading level={3}>{interview.role}</Heading>
            <Badge label={status.label} variant={status.badge} />
          </HStack>
          <Text color="secondary" display="block">
            {interview.company} · {interview.round}
          </Text>
          <HStack gap={3} wrap="wrap">
            <Text type="supporting" weight="medium">
              {formatTime(interview.start)} – {formatTime(interview.end)}
            </Text>
            <Text type="supporting" color="secondary">
              {FORMAT_LABEL[interview.format]}
            </Text>
            <Text type="supporting" color="secondary">
              {relativeDay(interview.date)}
            </Text>
            {interview.prep.length > 0 ? (
              <Text
                type="supporting"
                color={done === interview.prep.length ? "accent" : "secondary"}
              >
                Prep {done}/{interview.prep.length}
              </Text>
            ) : null}
          </HStack>
        </Stack>
      </HStack>
    </ClickableCard>
  );
}
