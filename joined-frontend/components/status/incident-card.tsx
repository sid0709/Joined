import { Badge, HStack, SectionCard, Stack, Text, Timeline, type TimelineItem } from "sid-ui";
import { PHASE_LABEL, formatTime, type StatusComponent, type StatusIncident } from "@/lib/status";

const IMPACT_BADGE = {
  none: "neutral",
  minor: "warning",
  major: "warning",
  critical: "error",
} as const;

const IMPACT_LABEL = {
  none: "Notice",
  minor: "Minor",
  major: "Major",
  critical: "Critical",
} as const;

function updates(incident: StatusIncident): TimelineItem[] {
  return incident.updates.map((update, index) => ({
    id: `${incident.id}-${index}`,
    title: PHASE_LABEL[update.status],
    time: formatTime(update.at),
    description: update.message,
    tone: update.status === "resolved" ? "success" : index === 0 ? "warning" : "neutral",
    status: index === 0 ? "current" : "done",
  }));
}

/** An unresolved incident: what is affected and every update, newest first. */
export function IncidentCard({
  incident,
  components,
}: {
  incident: StatusIncident;
  components: StatusComponent[];
}) {
  const affected = incident.components
    .map((id) => components.find((component) => component.id === id)?.name ?? id)
    .join(", ");
  return (
    <SectionCard
      title={incident.title}
      description={`Affects ${affected}`}
      action={
        <Badge label={IMPACT_LABEL[incident.impact]} variant={IMPACT_BADGE[incident.impact]} />
      }
    >
      <Timeline label={`Updates on ${incident.title}`} items={updates(incident)} />
    </SectionCard>
  );
}

/** One line in the history: the incident, how it ended, and when. */
export function IncidentSummary({ incident }: { incident: StatusIncident }) {
  const latest = incident.updates[0];
  return (
    <Stack gap={1}>
      <HStack gap={2} vAlign="center" wrap="wrap">
        <Text weight="semibold">{incident.title}</Text>
        <Badge
          label={PHASE_LABEL[incident.status]}
          variant={incident.status === "resolved" ? "success" : "warning"}
        />
      </HStack>
      {latest ? (
        <Text type="supporting" color="secondary">
          {latest.message} · {formatTime(latest.at)}
        </Text>
      ) : null}
    </Stack>
  );
}
