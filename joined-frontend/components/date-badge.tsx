import { Card, Heading, Stack, Text } from "sid-ui";
import { formatMonthDay } from "@/lib/dates";

const BADGE_WIDTH = 64;

/** A tear-off calendar date: month over a large day number. */
export function DateBadge({ date, isMuted = false }: { date: Date; isMuted?: boolean }) {
  const { month, day, weekday } = formatMonthDay(date);
  return (
    <Card padding={2} variant={isMuted ? "muted" : "blue"} width={BADGE_WIDTH}>
      <Stack gap={0} hAlign="center">
        <Text type="supporting" weight="semibold" color={isMuted ? "secondary" : "accent"}>
          {month}
        </Text>
        <Heading level={3} type="display-3">
          {day}
        </Heading>
        <Text type="supporting" color="secondary">
          {weekday}
        </Text>
      </Stack>
    </Card>
  );
}
