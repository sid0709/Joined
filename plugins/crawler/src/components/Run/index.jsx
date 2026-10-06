import { useMemo, useState } from "react";
import { Banner, Button, Glyph, Text, VStack } from "sid-ui";

import { useActiveTab } from "../../api/activeTab";
import { hasExtensionRuntime } from "../../api/runtimeMessage";
import useBackendHealth from "../../api/useBackendHealth";
import { API_URL, CRAWLER_INGEST_TOKEN, DUPLICATE_WINDOW_DAYS } from "../../config/env";
import { findRoutinesForUrl } from "../../routineKit/match";
import { ROUTINES } from "../../routines";
import { ROUTINE_OUTPUTS } from "../../routines/outputs";

import LiveRunCard from "./LiveRunCard";
import ResultsCard from "./ResultsCard";
import { startBlocker } from "./runState";
import TargetCard from "./TargetCard";
import { RUN_STATUS, useRoutineRun } from "./useRoutineRun";

const JOB_ROUTINES = ROUTINES.filter((routine) => routine.output === ROUTINE_OUTPUTS.JOB);

function BackendBanner() {
  const { status } = useBackendHealth();
  if (status !== "disconnected") return null;
  return (
    <Banner
      status="warning"
      title="Backend offline"
      description="Jobs wait in the queue and save when it is back."
    />
  );
}

function RunActionBar({ run, routine, blocker, onStart }) {
  const isRunning = run.status === RUN_STATUS.RUNNING;
  return (
    <div className="crawler-action-bar">
      <VStack gap={1.5}>
        {isRunning ? (
          <Button
            variant="destructive"
            size="lg"
            label="Stop run"
            icon={<Glyph name="pause" />}
            onClick={run.stop}
            width="100%"
          />
        ) : (
          <Button
            variant="primary"
            size="lg"
            label={routine ? `Start ${routine.label}` : "Start"}
            icon={<Glyph name="play" />}
            onClick={onStart}
            isDisabled={Boolean(blocker)}
            isLoading={run.isStarting}
            width="100%"
          />
        )}
        {!isRunning && blocker ? (
          <Text type="supporting" color="secondary" justify="center">
            {blocker}
          </Text>
        ) : null}
      </VStack>
    </div>
  );
}

/** Pick the routine for the focused tab, run it, and watch the run. */
export default function RunPanel({ onBrowseRoutines }) {
  const activeTab = useActiveTab();
  const run = useRoutineRun();
  const [chosenRoutineId, setChosenRoutineId] = useState(null);

  const matches = useMemo(
    () => (activeTab ? findRoutinesForUrl(JOB_ROUTINES, activeTab.url) : []),
    [activeTab],
  );
  const chosenRoutine =
    matches.find((routine) => routine.id === chosenRoutineId) ?? matches[0] ?? null;

  const isRunning = run.status === RUN_STATUS.RUNNING;
  const tab = isRunning ? run.target.tab : activeTab;
  const routine = isRunning ? run.target.routine : chosenRoutine;
  const shownRoutine = run.status === RUN_STATUS.IDLE ? routine : (run.target?.routine ?? routine);
  const blocker = startBlocker({
    hasRuntime: hasExtensionRuntime(),
    apiUrl: API_URL,
    ingestToken: CRAWLER_INGEST_TOKEN,
    duplicateWindowDays: DUPLICATE_WINDOW_DAYS,
    tab: activeTab,
    routine: chosenRoutine,
  });

  return (
    <div className="crawler-run">
      <VStack gap={3}>
        <BackendBanner />
        <TargetCard
          tab={tab}
          routine={routine}
          matches={matches}
          onChooseRoutine={setChosenRoutineId}
          isRunning={isRunning}
          onBrowseRoutines={onBrowseRoutines}
        />
        {run.status === RUN_STATUS.IDLE ? null : <LiveRunCard run={run} routine={shownRoutine} />}
        <ResultsCard stats={run.runStats} queue={run.queueCounts} recentJobs={run.recentJobs} />
      </VStack>
      <RunActionBar
        run={run}
        routine={chosenRoutine}
        blocker={blocker}
        onStart={() => run.start(activeTab, chosenRoutine)}
      />
    </div>
  );
}
