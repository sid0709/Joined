import { HStack, Text, VStack } from "@joined/design-system";

import { formatElapsedTime, getSkippedScrapeCount } from "../../../api/scrapeRunStats";

function RunSummary({ elapsedMs, stats, targetTab, routine, queue }) {
  const skipped = getSkippedScrapeCount(stats);
  const totals = [
    { label: "Registered", value: stats.registered, tone: "crawler-tone-success" },
    { label: "Skipped", value: skipped, tone: "crawler-tone-warning" },
    { label: "Failed", value: stats.failed, tone: "crawler-tone-error" },
    { label: "Queued", value: queue.queued, tone: "crawler-tone-accent" },
    { label: "Saving", value: queue.saving, tone: "crawler-tone-accent" },
  ];

  return (
    <VStack gap={2} width="100%">
      <HStack align="center" justify="between">
        <Text type="supporting" weight="semibold">
          Run results
        </Text>
        <Text type="supporting" weight="semibold" color="accent" hasTabularNumbers>
          {formatElapsedTime(elapsedMs)}
        </Text>
      </HStack>
      <div className="crawler-stat-grid">
        {totals.map(({ label, value, tone }) => (
          <VStack key={label} gap={0.5} className="crawler-stat">
            <Text type="large" weight="semibold" hasTabularNumbers className={tone}>
              {value}
            </Text>
            <Text type="supporting" color="secondary">
              {label}
            </Text>
          </VStack>
        ))}
      </div>
      <Text type="supporting" color="secondary" justify="center">
        Duplicates {stats.duplicate} · Validation {stats.validation} · Blocked {stats.blocked}
      </Text>
      {targetTab && (
        <Text type="supporting" color="secondary" justify="center" maxLines={1}>
          <span title={targetTab.url}>
            {routine ? `${routine.label} · ` : ""}Target tab #{targetTab.id}:{" "}
            {targetTab.title || new URL(targetTab.url).hostname}
          </span>
        </Text>
      )}
    </VStack>
  );
}

export default RunSummary;
