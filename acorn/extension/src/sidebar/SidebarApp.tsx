import { useEffect, useMemo, useState } from "react";
import { isFillPhaseBusy } from "@acorn/shared/pipeline-types";
import { customTabHasResume } from "../tab-custom-session";
import { countBusyWorkers, tabInputFromProgress } from "../acorn-face/director";
import { useCompanionFace } from "../acorn-face/use-companion-face";
import { pushAcornNotice } from "./acorn-notice";
import { hostOf } from "./custom-tab-resume";
import { NowCard } from "./NowCard";
import { SidebarHeader } from "./SidebarHeader";
import { SidebarNav, type AcornMainTab } from "./SidebarNav";
import { actionBarState, isAnyTabWorking, isGenerateBusy } from "./sidebar-work-state";
import { useActiveTabId } from "./use-active-tab";
import { usePlanInspect } from "./use-plan-inspect";
import { useResumePreview } from "./use-resume-preview";
import { useSidebarAuth } from "./use-sidebar-auth";
import { useSocketStatus } from "./use-socket-status";
import { useTabSession } from "./use-tab-session";
import { useTabUi } from "./use-tab-ui";
import { useTabWork } from "./use-tab-work";
import { useWorkerJobs } from "./use-worker-jobs";
import { AskPanel } from "./AskPanel";
import { CustomPanel } from "./CustomPanel";
import { JobsPanel } from "./JobsPanel";
import { SidebarOverlays } from "./SidebarOverlays";
import { SignedOutView } from "./SignedOutView";
import type { JdPreview } from "./sidebar-panel-types";
import "./SidebarApp.css";

export default function SidebarApp() {
  const activeTabId = useActiveTabId();
  const {
    tabJob,
    customTab,
    customList,
    jobGenerates,
    pipelines,
    progress,
    attachments,
    setPipelines,
  } = useTabSession(activeTabId);

  const [jdPreview, setJdPreview] = useState<JdPreview | null>(null);
  const [mainTab, setMainTab] = useState<AcornMainTab>("fill");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [qaStatus, setQaStatus] = useState({ busy: false, error: false });
  const [helpOpen, setHelpOpen] = useState(false);

  const { apiUrl, setApiUrl, session, authBusy, handleSignIn, handleSignOut } = useSidebarAuth({
    onSignedOut: () => setHelpOpen(false),
  });
  const connected = useSocketStatus(session, apiUrl);
  const { ui, patchTabUi } = useTabUi(activeTabId, progress);
  const {
    workerJobs,
    workerJobsLoading,
    workerJobsError,
    openingJobId,
    markingJobId,
    jobsListKey,
    fetchWorkerJobs,
    openWorkerJob,
    markJobApplied,
  } = useWorkerJobs({ session, activeTabId, attachments });
  const { preview, setPreview, openJobResumePreview, openCustomResumePreview } =
    useResumePreview(jobGenerates);

  const fillBusy = isFillPhaseBusy(progress.phase);
  const generateBusy = isGenerateBusy(customTab, tabJob, jobGenerates);
  const tabWorkBusy = fillBusy || generateBusy;
  const anyTabWorking = isAnyTabWorking(pipelines, customList, jobGenerates);
  const busyCounts = useMemo(
    () => countBusyWorkers(pipelines, customList, Object.values(jobGenerates)),
    [pipelines, customList, jobGenerates],
  );
  const busyTotal = busyCounts.thinking + busyCounts.working;
  const workersMode =
    busyCounts.working > 0 ? "working" : busyCounts.thinking > 0 ? "thinking" : "waiting";
  const fillErrorText =
    progress.phase === "error" ? progress.error || progress.message || "Fill failed" : null;

  useEffect(() => {
    if (!fillErrorText) return;
    pushAcornNotice({
      kind: "error",
      title: "Fill couldn’t finish",
      detail: fillErrorText,
    });
  }, [fillErrorText]);

  const {
    remembering,
    startPipeline,
    rememberFocusedTab,
    forgetCustomTab,
    focusCustomTab,
    startJobWork,
    startCustomWork,
  } = useTabWork({
    activeTabId,
    mainTab,
    tabJob,
    customTab,
    setPipelines,
    tabWorkBusy,
    workerJobs,
  });

  const {
    lastFetch,
    plan,
    steps,
    nodeCount,
    visibleSteps,
    hasMoreSteps,
    loadMoreSteps,
    stepsListRef,
    inspectWindow,
    inspectView,
    stepSummary,
    openInspect,
  } = usePlanInspect({ activeTabId, ui, progress, patchTabUi });

  const hasTree = Boolean(lastFetch);
  const companionMode = useCompanionFace({
    signedIn: Boolean(session),
    authBusy,
    nameFocused: false,
    connected,
    anyTabWorking,
    focused: tabInputFromProgress(Boolean(session), progress, {
      status: customTab?.generateStatus ?? null,
      label: customTab?.generateProgress?.label ?? null,
      hasResume: customTab ? customTabHasResume(customTab) : false,
    }),
    qaBusy: qaStatus.busy,
    qaError: qaStatus.error,
    inspectOpen: Boolean(ui.inspect || preview || helpOpen),
    connectionOpen: settingsOpen,
    jobsLoading: workerJobsLoading,
    jobsEmpty:
      Boolean(session) &&
      mainTab === "fill" &&
      !workerJobsLoading &&
      !workerJobsError &&
      workerJobs.length === 0,
    jobsError: Boolean(workerJobsError),
    customEmpty: Boolean(session) && mainTab === "custom" && customList.length === 0,
    opening: Boolean(openingJobId) || remembering,
    marking: Boolean(markingJobId),
  });

  const customLocked = mainTab === "custom" && !customTab;
  const fillLocked = mainTab === "fill" && !tabJob;
  const rememberFirst = "Remember this tab first";
  const openJobFirst = "Open a Worker pool job first";
  const actionsOff = tabWorkBusy || !session || activeTabId == null || customLocked;
  const {
    attachedJobGenerate,
    fillCanContinue,
    customCanContinue,
    generateLabel,
    recommendLabel,
    fillLabel,
  } = actionBarState({
    mainTab,
    tabJob,
    customTab,
    jobGenerates,
    workerJobs,
    progress,
    fillBusy,
    generateBusy,
  });

  const tabWorkJob = tabJob ? (workerJobs.find((job) => job.id === tabJob.jobId) ?? null) : null;
  const headerContext =
    mainTab === "custom" && customTab
      ? hostOf(customTab.url)
      : tabJob
        ? `${tabJob.company} · ${tabJob.title}`
        : "No job on this tab";
  const nowActions = {
    fill: {
      label: fillLabel,
      title: customLocked ? rememberFirst : fillLabel,
      disabled: actionsOff,
      onClick: () => void startPipeline(mainTab === "custom" ? "custom" : "fill"),
    },
    generate: {
      label: generateLabel,
      title: customLocked ? rememberFirst : fillLocked ? openJobFirst : generateLabel,
      disabled: actionsOff || fillLocked,
      onClick: () =>
        void startCustomWork("generate", {
          continue:
            mainTab === "fill"
              ? fillCanContinue && attachedJobGenerate?.workKind !== "recommend"
              : customCanContinue && customTab?.workKind !== "recommend",
        }),
    },
    recommend: {
      label: recommendLabel,
      title: customLocked ? rememberFirst : fillLocked ? openJobFirst : recommendLabel,
      disabled: actionsOff || fillLocked,
      onClick: () =>
        void startCustomWork("recommend", {
          continue:
            mainTab === "fill"
              ? fillCanContinue && attachedJobGenerate?.workKind === "recommend"
              : customCanContinue && customTab?.workKind === "recommend",
        }),
    },
    remember: {
      label: customTab ? "Tab remembered" : "Remember this tab",
      title: "Remember this tab for Custom",
      disabled: !session || activeTabId == null || Boolean(customTab) || tabWorkBusy,
      onClick: () => void rememberFocusedTab(),
    },
  };
  const nowCard = (tab: "fill" | "custom") => (
    <NowCard
      mainTab={tab}
      tabJob={tabJob}
      job={tabWorkJob}
      jobGenerate={attachedJobGenerate}
      customTab={customTab}
      progress={progress}
      fillBusy={fillBusy}
      {...nowActions}
    />
  );

  return (
    <div className={`sidebar-app${session ? " signed-in" : ""} tab-${session ? mainTab : "fill"}`}>
      {session ? (
        <>
          <div className="acorn-top">
            <SidebarHeader
              session={session}
              companionMode={companionMode}
              workersMode={workersMode}
              busyCounts={busyCounts}
              busyTotal={busyTotal}
              connected={connected}
              context={headerContext}
              signOutDisabled={authBusy || anyTabWorking}
              onOpenGuide={() => setHelpOpen(true)}
              onOpenSettings={() => setSettingsOpen(true)}
              onSignOut={() => void handleSignOut()}
            />
            <SidebarNav
              value={mainTab}
              onChange={setMainTab}
              busyJobs={busyTotal}
              rememberedTabs={customList.length}
            />
          </div>

          <main className="sidebar-scroll">
            <JobsPanel
              mainTab={mainTab}
              nowCard={nowCard("fill")}
              workerJobs={workerJobs}
              workerJobsLoading={workerJobsLoading}
              workerJobsError={workerJobsError}
              openingJobId={openingJobId}
              markingJobId={markingJobId}
              jobsListKey={jobsListKey}
              fetchWorkerJobs={fetchWorkerJobs}
              openWorkerJob={openWorkerJob}
              markJobApplied={markJobApplied}
              tabJob={tabJob}
              attachments={attachments}
              pipelines={pipelines}
              jobGenerates={jobGenerates}
              openJobResumePreview={openJobResumePreview}
              startJobWork={startJobWork}
              setJdPreview={setJdPreview}
            />

            <AskPanel
              mainTab={mainTab}
              fillBusy={fillBusy}
              setQaStatus={setQaStatus}
              tabJob={tabJob}
            />

            <CustomPanel
              mainTab={mainTab}
              nowCard={nowCard("custom")}
              customList={customList}
              pipelines={pipelines}
              activeTabId={activeTabId}
              focusCustomTab={focusCustomTab}
              forgetCustomTab={forgetCustomTab}
              startCustomWork={startCustomWork}
              openCustomResumePreview={openCustomResumePreview}
              setJdPreview={setJdPreview}
            />
          </main>
        </>
      ) : (
        <SignedOutView
          authBusy={authBusy}
          handleSignIn={handleSignIn}
          companionMode={companionMode}
          fillBusy={fillBusy}
          hasTree={hasTree}
          lastFetch={lastFetch}
          nodeCount={nodeCount}
          plan={plan}
          steps={steps}
          stepSummary={stepSummary}
          visibleSteps={visibleSteps}
          stepsListRef={stepsListRef}
          hasMoreSteps={hasMoreSteps}
          loadMoreSteps={loadMoreSteps}
          openInspect={openInspect}
        />
      )}

      <SidebarOverlays
        activeTabId={activeTabId}
        preview={preview}
        setPreview={setPreview}
        jdPreview={jdPreview}
        setJdPreview={setJdPreview}
        ui={ui}
        patchTabUi={patchTabUi}
        inspectView={inspectView}
        inspectWindow={inspectWindow}
        helpOpen={helpOpen}
        setHelpOpen={setHelpOpen}
        busyCounts={busyCounts}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        connected={connected}
        session={session}
        apiUrl={apiUrl}
        setApiUrl={setApiUrl}
      />
    </div>
  );
}
