import { Divider, Heading, SectionCard, Stack, Text } from "sid-ui";
import { formatDay, type StatusPage } from "@/lib/status";
import { IncidentSummary } from "./incident-card";

/** The last two weeks, day by day, saying so when nothing happened. */
export function IncidentHistory({ history }: { history: StatusPage["history"] }) {
  return (
    <SectionCard title="Past incidents">
      <Stack gap={4}>
        {history.map((day, index) => (
          <Stack key={day.date} gap={3}>
            {index > 0 ? <Divider /> : null}
            <Heading level={3}>{formatDay(day.date)}</Heading>
            {day.incidents.length === 0 ? (
              <Text color="secondary">No incidents reported.</Text>
            ) : (
              day.incidents.map((incident) => (
                <IncidentSummary key={incident.id} incident={incident} />
              ))
            )}
          </Stack>
        ))}
      </Stack>
    </SectionCard>
  );
}
