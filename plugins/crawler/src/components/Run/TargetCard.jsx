import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Glyph,
  HStack,
  NumberInput,
  Selector,
  Switch,
  Text,
  Token,
  VStack,
} from "sid-ui";

import {
  DEFAULT_CONCURRENCY,
  DEFAULT_JOBS_PER_SECOND,
  MIN_CONCURRENCY,
  MIN_JOBS_PER_SECOND,
  paceLimits,
} from "../../api/paceSettings";
import { SCRAPE_SOURCE } from "../../config/env";
import { listDeclaredFields } from "../../routineKit/declaredFields";
import { STRATEGY_LABELS } from "../../routineKit/describe";
import { hasRunSetting, RUN_SETTING } from "../../routineKit/runView";

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function RoutineTokens({ routine }) {
  const fieldCount = listDeclaredFields(routine).length;
  return (
    <HStack gap={1} wrap="wrap">
      <Token size="sm" color="purple" label={STRATEGY_LABELS[routine.strategy.kind]} />
      <Token size="sm" color="gray" label={`${fieldCount} fields`} />
      <Token size="sm" color="gray" label={`v${routine.version}`} />
      <Token size="sm" color="orange" label={SCRAPE_SOURCE} description="Job scrape source" />
    </HStack>
  );
}

/** The page a run acts on and the routine that will run there. */
function PaceSettings({ routine, settings, onChange, isRunning }) {
  const showConcurrency = hasRunSetting(routine, RUN_SETTING.CONCURRENCY);
  const showRate = hasRunSetting(routine, RUN_SETTING.JOBS_PER_SECOND);
  const showFastMode = hasRunSetting(routine, RUN_SETTING.FAST_MODE);
  if (!showConcurrency && !showRate && !showFastMode) return null;
  const limits = paceLimits(settings.fastMode);
  return (
    <VStack gap={3}>
      {showFastMode ? (
        <Switch
          label="Advanced / fast mode"
          value={Boolean(settings.fastMode)}
          onChange={(value) => onChange({ fastMode: value })}
          isDisabled={isRunning}
        />
      ) : null}
      <Text type="supporting" color="secondary">
        {settings.fastMode
          ? `Up to ${limits.concurrency} workers and ${limits.jobsPerSecond} jobs/s`
          : `Default ${DEFAULT_CONCURRENCY} workers / ${DEFAULT_JOBS_PER_SECOND} jobs/s. Enable fast mode to raise the cap.`}
      </Text>
      <HStack gap={3}>
        {showConcurrency ? (
          <NumberInput
            label="Concurrency"
            description={`Up to ${limits.concurrency} parallel detail fetches`}
            value={settings.concurrency}
            min={MIN_CONCURRENCY}
            max={limits.concurrency}
            onChange={(value) => onChange({ concurrency: value })}
            isDisabled={isRunning}
            width="100%"
          />
        ) : null}
        {showRate ? (
          <NumberInput
            label="Jobs / s"
            description="Token-bucket target"
            value={settings.jobsPerSecond}
            min={MIN_JOBS_PER_SECOND}
            max={limits.jobsPerSecond}
            onChange={(value) => onChange({ jobsPerSecond: value })}
            isDisabled={isRunning}
            width="100%"
          />
        ) : null}
      </HStack>
    </VStack>
  );
}

export default function TargetCard({
  tab,
  routine,
  matches,
  onChooseRoutine,
  isRunning,
  onBrowseRoutines,
  paceSettings,
  onPaceSettingsChange,
}) {
  if (!tab) {
    return (
      <Card padding={4}>
        <EmptyState
          isCompact
          headingLevel={3}
          icon={<Glyph name="eye" />}
          title="Focus a web page"
          description="The panel follows the tab you are on. Open a job site in this window."
          actions={
            <Button
              variant="secondary"
              size="sm"
              label="Browse routines"
              onClick={onBrowseRoutines}
            />
          }
        />
      </Card>
    );
  }

  const host = hostOf(tab.url);
  const badge = isRunning
    ? { variant: "blue", label: "Running" }
    : routine
      ? { variant: "success", label: "Ready" }
      : { variant: "neutral", label: "No routine" };

  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack gap={3} align="center">
          <Avatar
            name={routine?.label ?? host}
            shape="rounded"
            size="md"
            className="crawler-fixed"
          />
          <VStack gap={0.5} className="crawler-grow">
            <Text type="supporting" color="secondary">
              {isRunning ? "Running on" : "Active tab"}
            </Text>
            <Text weight="semibold" maxLines={1} hasTruncateTooltip>
              {routine ? routine.label : host}
            </Text>
            <Text type="supporting" color="secondary" maxLines={1} hasTruncateTooltip>
              {tab.title ? `${tab.title} · ${host}` : host}
            </Text>
          </VStack>
          <Badge variant={badge.variant} label={badge.label} className="crawler-fixed" />
        </HStack>

        {routine ? (
          <RoutineTokens routine={routine} />
        ) : (
          <HStack gap={2} align="center" justify="between">
            <Text type="supporting" color="secondary">
              No routine knows this site yet.
            </Text>
            <Button variant="ghost" size="sm" label="See routines" onClick={onBrowseRoutines} />
          </HStack>
        )}

        {!isRunning && matches.length > 1 ? (
          <Selector
            label="Routine"
            description="More than one routine runs on this site."
            options={matches.map((match) => ({ value: match.id, label: match.label }))}
            value={routine?.id ?? matches[0].id}
            onChange={onChooseRoutine}
          />
        ) : null}

        {routine && paceSettings ? (
          <PaceSettings
            routine={routine}
            settings={paceSettings}
            onChange={onPaceSettingsChange}
            isRunning={isRunning}
          />
        ) : null}
      </VStack>
    </Card>
  );
}
