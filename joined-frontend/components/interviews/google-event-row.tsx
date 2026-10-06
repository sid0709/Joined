import { Card, HStack, Link, Stack, Text } from "sid-ui";
import { formatTime } from "@/lib/dates";
import type { GoogleEvent } from "@/lib/google-calendar";

/** One event from the job hunter's Google Calendar: read-only, opens in Google. */
export function GoogleEventRow({ event }: { event: GoogleEvent }) {
  const when =
    event.allDay || !event.start
      ? "All day"
      : `${formatTime(event.start)} – ${formatTime(event.end ?? event.start)}`;

  return (
    <Card padding={4}>
      <Stack gap={1}>
        <Text weight="medium" display="block">
          {event.title}
        </Text>
        <HStack gap={3} wrap="wrap">
          <Text type="supporting" weight="medium">
            {when}
          </Text>
          {event.location ? (
            <Text type="supporting" color="secondary" maxLines={1}>
              {event.location}
            </Text>
          ) : null}
          {event.link ? (
            <Link href={event.link} target="_blank" rel="noopener noreferrer">
              Open in Google Calendar
            </Link>
          ) : null}
        </HStack>
      </Stack>
    </Card>
  );
}
