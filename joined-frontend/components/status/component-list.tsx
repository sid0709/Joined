import { Badge, Divider, HStack, SectionCard, Stack, Text, UptimeBar } from "sid-ui";
import {
  STATUS_BADGE,
  STATUS_LABEL,
  formatUptime,
  uptimeDays,
  type StatusComponent,
} from "@/lib/status";

/** Each part of Joined: its status now and one bar per day for the last 90 days. */
export function ComponentList({ components }: { components: StatusComponent[] }) {
  return (
    <SectionCard
      title="Systems"
      description="Uptime over the last 90 days. Hover or tap a day for details."
    >
      <Stack gap={5}>
        {components.map((component, index) => (
          <Stack key={component.id} gap={5}>
            {index > 0 ? <Divider /> : null}
            <Stack gap={3}>
              <HStack hAlign="between" vAlign="start" gap={3} wrap="wrap">
                <Stack gap={0.5}>
                  <Text weight="semibold">{component.name}</Text>
                  <Text type="supporting" color="secondary">
                    {component.description}
                  </Text>
                </Stack>
                <Badge
                  label={STATUS_LABEL[component.status]}
                  variant={STATUS_BADGE[component.status]}
                />
              </HStack>
              <UptimeBar
                label={`${component.name} uptime, last ${component.days.length} days`}
                days={uptimeDays(component)}
                startLabel={`${component.days.length} days ago`}
                endLabel="Today"
                summary={
                  component.uptime == null
                    ? "No data yet"
                    : `${formatUptime(component.uptime)} uptime`
                }
              />
            </Stack>
          </Stack>
        ))}
      </Stack>
    </SectionCard>
  );
}
