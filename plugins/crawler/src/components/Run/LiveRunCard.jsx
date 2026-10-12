import {
  Badge,
  Banner,
  Card,
  HStack,
  ProgressBar,
  StatusDot,
  Step,
  Stepper,
  Text,
  VStack,
} from "sid-ui";

import { formatElapsedTime } from "../../api/scrapeRunStats";
import { hasRunComponent, hasRunStat, RUN_COMPONENT, RUN_STAT } from "../../routineKit/runView";
import { heartedCountLabel, SIGN_IN_TO_SAVE_MESSAGE } from "../../routines/builtin/constants";
import { markedCountLabel, SIGN_IN_TO_MARK_MESSAGE } from "../../routines/hiringcafe/constants";

import { extractErrorBanner } from "./extractErrorBanner";
import FieldChecklist from "./FieldChecklist";
import { RUN_STEPS, runStepIndex } from "./runState";
import { RUN_STATUS } from "./useRoutineRun";

const STATUS_META = {
  [RUN_STATUS.RUNNING]: { dot: "accent", title: "Running", isPulsing: true },
  [RUN_STATUS.FINISHED]: { dot: "success", title: "Finished" },
  [RUN_STATUS.STOPPED]: { dot: "neutral", title: "Stopped" },
};

const formatPercent = (value) => `${Math.round(value)}%`;

const STUCK_BANNER_TITLE =
  "Crawl stopped: sign in to Built In (or the page is dead), then press Start to resume from the saved cursor";

const STEPPER_LAYOUT = { minimumStepWidth: 56, collapsedVariant: "withLabel" };

function cursorLabel(pace) {
  if (!pace?.page) return "";
  if (pace.jobIndex && pace.jobsOnPage) {
    return `Page ${pace.page} · job ${pace.jobIndex} of ${pace.jobsOnPage}`;
  }
  if (pace.cardIndex && pace.cardsOnPage) {
    return `Page ${pace.page} · card ${pace.cardIndex} of ${pace.cardsOnPage}`;
  }
  if (pace.card) return `Page ${pace.page} · card ${pace.card}`;
  return `Page ${pace.page}`;
}

function blockReasons(pace) {
  const kinds = (pace?.blocks ?? []).map((entry) => entry.kind).filter(Boolean);
  if (pace?.lastBlock && !kinds.includes(pace.lastBlock)) kinds.push(pace.lastBlock);
  return kinds.join(", ");
}

function PaceStats({ pace, routine }) {
  if (!pace) return null;
  const showRate = hasRunStat(routine, RUN_STAT.JOBS_PER_SECOND);
  const showConcurrency = hasRunStat(routine, RUN_STAT.CONCURRENCY);
  const showCursor = hasRunStat(routine, RUN_STAT.CURSOR);
  const showBlocks = hasRunStat(routine, RUN_STAT.BLOCKS);
  const showHearts = hasRunStat(routine, RUN_STAT.HEARTS);
  const showMarked = hasRunStat(routine, RUN_STAT.MARKED);
  const cursor = cursorLabel(pace);
  const reasons = blockReasons(pace);
  if (!showRate && !showConcurrency && !showCursor && !showBlocks && !showHearts && !showMarked) {
    return null;
  }
  if (!showRate && !showConcurrency && !cursor && !pace.blockCount && !showHearts && !showMarked) {
    return null;
  }
  return (
    <HStack gap={2} wrap="wrap">
      {showCursor && cursor ? (
        <Badge variant="neutral" label={cursor} description="List cursor" />
      ) : null}
      {showHearts ? (
        <Badge
          variant="neutral"
          label={heartedCountLabel(pace.hearted ?? 0, pace.notHearted ?? 0)}
          description="List-card hearts this run"
        />
      ) : null}
      {showMarked ? (
        <Badge
          variant="neutral"
          label={markedCountLabel(pace.marked ?? 0, pace.notMarked ?? 0)}
          description="Mark Applied this run"
        />
      ) : null}
      {showRate ? (
        <Badge
          variant="blue"
          label={`${pace.jobsPerSecond ?? 0} jobs/s`}
          description="Live ingest pace"
        />
      ) : null}
      {showConcurrency ? (
        <Badge
          variant="neutral"
          label={`${pace.concurrency ?? 0} concurrent`}
          description="Current fetch concurrency"
        />
      ) : null}
      {showBlocks && pace.blockCount ? (
        <Badge
          variant="orange"
          label={`${pace.blockCount} blocks`}
          description={reasons || "Blocks in window"}
        />
      ) : null}
    </HStack>
  );
}

/** The current run: only the components the active routine declared. */
export default function LiveRunCard({ run, routine }) {
  const meta = STATUS_META[run.status] ?? STATUS_META[RUN_STATUS.STOPPED];
  const isRunning = run.status === RUN_STATUS.RUNNING;
  const activeStep = isRunning ? runStepIndex(run.activity?.phase) : RUN_STEPS.length;
  const showStepper = hasRunComponent(routine, RUN_COMPONENT.STEPPER);
  const showPace = hasRunComponent(routine, RUN_COMPONENT.PACE);
  const showFields = hasRunComponent(routine, RUN_COMPONENT.FIELD_GROUPS);
  const extractionBanner = extractErrorBanner(run.extractError);

  return (
    <Card padding={4}>
      <VStack gap={4}>
        <HStack align="center" justify="between" gap={2}>
          <HStack gap={2} align="center">
            <StatusDot variant={meta.dot} label={meta.title} isPulsing={meta.isPulsing} />
            <Text weight="semibold">{meta.title}</Text>
            {run.passCount ? <Badge variant="neutral" label={`Pass ${run.passCount}`} /> : null}
          </HStack>
          <Text type="supporting" color="secondary" hasTabularNumbers>
            {formatElapsedTime(run.elapsedMs)}
          </Text>
        </HStack>

        {run.warning ? (
          <Banner
            status="warning"
            title={
              run.warning === SIGN_IN_TO_SAVE_MESSAGE || run.warning === SIGN_IN_TO_MARK_MESSAGE
                ? run.warning
                : STUCK_BANNER_TITLE
            }
            description={
              run.warning === SIGN_IN_TO_SAVE_MESSAGE || run.warning === SIGN_IN_TO_MARK_MESSAGE
                ? "Press Start to resume from the saved cursor after you sign in."
                : run.warning
            }
          />
        ) : null}

        {extractionBanner ? (
          <Banner
            status={extractionBanner.status}
            title={extractionBanner.title}
            description={extractionBanner.description}
          />
        ) : null}

        {showPace ||
        hasRunStat(routine, RUN_STAT.CURSOR) ||
        hasRunStat(routine, RUN_STAT.BLOCKS) ||
        hasRunStat(routine, RUN_STAT.HEARTS) ||
        hasRunStat(routine, RUN_STAT.MARKED) ? (
          <PaceStats pace={run.pace} routine={routine} />
        ) : null}

        {isRunning && showStepper ? (
          <>
            <Stepper
              activeStep={activeStep}
              density="compact"
              label="Pass phase"
              horizontalOptions={STEPPER_LAYOUT}
            >
              {RUN_STEPS.map((step, index) => (
                <Step key={step.label} step={index} label={step.label} />
              ))}
            </Stepper>
            <ProgressBar
              label={run.activity?.label ?? "Starting…"}
              value={run.progress}
              hasValueLabel
              formatValueLabel={formatPercent}
            />
          </>
        ) : null}

        {showFields && routine ? (
          <FieldChecklist
            routine={routine}
            fieldStates={run.fieldStates}
            fieldHits={run.fieldHits}
          />
        ) : null}
      </VStack>
    </Card>
  );
}
