import { Badge, Text, VStack } from "@joined/design-system";

import { SCRAPE_SOURCE } from "../config/env";

export default function ScrapeSourceBadge({ compact = false }) {
  return (
    <VStack gap={1} align="start">
      <Text type={compact ? "supporting" : "label"} color="secondary">
        Job scrape source
      </Text>
      <span title={SCRAPE_SOURCE}>
        <Badge variant="warning" label={SCRAPE_SOURCE} />
      </span>
    </VStack>
  );
}
