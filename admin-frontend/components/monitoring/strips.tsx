import { Badge, HStack, SectionCard, Stack, Text, UptimeBar, type UptimeDay } from "sid-ui";
import { formatMs, formatShare, type StatusStrip, type UptimeSlot } from "@/lib/monitoring";

const UTC = "UTC";
const slotClock = new Intl.DateTimeFormat("en", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: UTC,
});
const dayLabel = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  timeZone: UTC,
});

function slotDays(slots: UptimeSlot[] | null): UptimeDay[] {
  return (slots ?? []).map((slot) => ({
    label: `${slotClock.format(new Date(slot.at))} ${UTC}`,
    tone: slot.tone,
    details: slot.uptime == null ? undefined : [`${formatShare(slot.uptime)} up`],
  }));
}

function historyDays(strip: StatusStrip): UptimeDay[] {
  return (strip.days ?? []).map((day) => ({
    label: dayLabel.format(new Date(`${day.date}T00:00:00Z`)),
    tone: day.tone,
    details: day.uptime == null ? undefined : [`${formatShare(day.uptime)} uptime`],
  }));
}

function upBadge(up: boolean | undefined) {
  if (up == null) return <Badge label="Not measured" variant="neutral" />;
  return <Badge label={up ? "Up" : "Down"} variant={up ? "success" : "error"} />;
}

/** Today in 15-minute bars, then one bar per UTC day for 90 days. */
export function AvailabilityStrips({
  strips,
  title,
  description,
}: {
  strips: StatusStrip[];
  title: string;
  description: string;
}) {
  if (strips.length === 0) return null;
  return (
    <SectionCard title={title} description={description}>
      <Stack gap={5}>
        {strips.map((strip) => (
          <Stack key={strip.id} gap={3}>
            <HStack hAlign="between" vAlign="start" gap={3} wrap="wrap">
              <Stack gap={0.5}>
                <Text weight="semibold">{strip.name}</Text>
                <Text type="supporting" color="secondary">
                  {strip.todayUptime == null
                    ? "No samples yet today"
                    : `${formatShare(strip.todayUptime)} up today`}
                  {strip.latencyMs != null ? ` · ${formatMs(strip.latencyMs)}` : ""}
                </Text>
              </Stack>
              {upBadge(strip.up)}
            </HStack>
            <UptimeBar
              label={`${strip.name} today, 15-minute intervals`}
              days={slotDays(strip.today)}
              startLabel="00:00 UTC"
              endLabel="Now"
            />
            <UptimeBar
              label={`${strip.name} uptime, last ${strip.days?.length ?? 90} days`}
              days={historyDays(strip)}
              startLabel="90 days ago"
              endLabel="Today"
              summary={
                strip.days?.some((day) => day.uptime != null) ? undefined : "No daily history yet"
              }
            />
          </Stack>
        ))}
      </Stack>
    </SectionCard>
  );
}
