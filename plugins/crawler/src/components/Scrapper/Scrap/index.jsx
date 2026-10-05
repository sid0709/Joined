import { Button, Card, Glyph, HStack, Text, VStack } from "@joined/design-system";

import ScrapeSourceBadge from "../../ScrapeSourceBadge";

import RunSummary from "./RunSummary";
import ScrapeProgress from "./ScrapeProgress";
import { useScrapeRun } from "./useScrapeRun";
import ValidationChecklist from "./ValidationChecklist";

const ScrapComponent = () => {
  const {
    progress,
    scrapFlag,
    starting,
    validationChecks,
    runStats,
    elapsedMs,
    targetTab,
    routine,
    queueCounts,
    onScrapStart,
    onScrapStop,
  } = useScrapeRun();

  return (
    <Card padding={4}>
      <VStack gap={5}>
        <VStack gap={1}>
          <Text type="supporting" weight="semibold" color="secondary">
            Automation
          </Text>
          <Text as="h2" type="large" weight="semibold">
            Scraping Controls
          </Text>
          <ScrapeSourceBadge />
        </VStack>
        <hr className="crawler-divider" />

        <Card variant="muted" padding={4}>
          <VStack gap={4} align="center">
            <ScrapeProgress value={progress} />
            <ValidationChecklist checks={validationChecks} />
            <hr className="crawler-divider" />
            <RunSummary
              elapsedMs={elapsedMs}
              stats={runStats}
              targetTab={targetTab}
              routine={routine}
              queue={queueCounts}
            />
          </VStack>
        </Card>

        <HStack gap={3}>
          <Button
            variant="destructive"
            label="Stop"
            icon={<Glyph name="close" />}
            onClick={onScrapStop}
            isDisabled={!scrapFlag}
            width="100%"
          />
          <Button
            variant="primary"
            label={starting ? "Remembering…" : "Start"}
            icon={<Glyph name="play" />}
            onClick={onScrapStart}
            isDisabled={scrapFlag || starting}
            width="100%"
          />
        </HStack>
      </VStack>
    </Card>
  );
};

export default ScrapComponent;
