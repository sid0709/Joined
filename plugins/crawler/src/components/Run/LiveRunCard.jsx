import { Badge, Card, HStack, ProgressBar, StatusDot, Step, Stepper, Text, VStack } from "sid-ui";

import { formatElapsedTime } from "../../api/scrapeRunStats";

import FieldChecklist from "./FieldChecklist";
import { RUN_STEPS, runStepIndex } from "./runState";
import { RUN_STATUS } from "./useRoutineRun";

const STATUS_META = {
  [RUN_STATUS.RUNNING]: { dot: "accent", title: "Running", isPulsing: true },
  [RUN_STATUS.FINISHED]: { dot: "success", title: "Finished" },
  [RUN_STATUS.STOPPED]: { dot: "neutral", title: "Stopped" },
};

const formatPercent = (value) => `${Math.round(value)}%`;

/** Keep all four phase labels visible down to a narrow side panel. */
const STEPPER_LAYOUT = { minimumStepWidth: 56, collapsedVariant: "withLabel" };

/** The current run: status, which phase of the pass it is in, what it is doing, and fields. */
export default function LiveRunCard({ run, routine }) {
  const meta = STATUS_META[run.status] ?? STATUS_META[RUN_STATUS.STOPPED];
  const isRunning = run.status === RUN_STATUS.RUNNING;
  const activeStep = isRunning ? runStepIndex(run.activity?.phase) : RUN_STEPS.length;

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

        {isRunning ? (
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

        {routine ? (
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
