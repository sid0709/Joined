import { useEffect, useMemo, useState } from "react";
import { isFillPhaseBusy } from "@acorn/shared/pipeline-types";
import { customTabHasResume } from "../tab-custom-session";
import { countBusyWorkers, tabInputFromProgress } from "../acorn-face/director";
import { useCompanionFace } from "../acorn-face/use-companion-face";
import { pushAcornNotice } from "./acorn-notice";
import { AnalyzedTreeSection } from "./AnalyzedTreeSection";
import { ConnectionFooter } from "./ConnectionFooter";
import { CustomTabList } from "./CustomTabList";
import { FaceGuidePanel } from "./FaceGuidePanel";
import { IdentityBar } from "./IdentityBar";
import { InspectPanel } from "./InspectPanel";
import { PlanRunSection } from "./PlanRunSection";
import { ResumePreviewPanel } from "./ResumePreviewPanel";
import { SidebarActionBar } from "./SidebarActionBar";
import type { AcornMainTab } from "./SidebarMainTabs";
import { SidebarTools } from "./SidebarTools";
import { SignInCard } from "./SignInCard";
import { WorkerPoolList } from "./WorkerPoolList";
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

  const [jdPreview, setJdPreview] = useState<{ title: string; text: string } | null>(null);
  const [mainTab, setMainTab] = useState<AcornMainTab>("fill");
  const [connectionOpen, setConnectionOpen] = useState(false);
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

  const connectionLabel = connected ? "Connected" : session ? "Offline" : "Sign in";
  const footerStatus = fillBusy ? progress.message : connectionLabel;
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
    connectionOpen,
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

  const showActionBar = Boolean(session) && mainTab !== "qa" && !helpOpen;
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

  return (
    <div
      className={`sidebar-app${session ? " signed-in" : ""} tab-${
        session ? mainTab : "fill"
      }${showActionBar ? " has-fill-cta" : ""}${helpOpen ? " help-open" : ""}`}
    >
      <div className="sidebar-scroll">
        <div className="sidebar-chrome">
          <IdentityBar
            session={session}
            companionMode={companionMode}
            workersMode={workersMode}
            busyCounts={busyCounts}
            busyTotal={busyTotal}
            helpOpen={helpOpen}
            signOutDisabled={authBusy || anyTabWorking}
            onToggleHelp={() => setHelpOpen((open) => !open)}
            onSignOut={() => void handleSignOut()}
          />
          {session ? null : <SignInCard authBusy={authBusy} onSignIn={() => void handleSignIn()} />}
        </div>

        {helpOpen ? (
          <FaceGuidePanel thinking={busyCounts.thinking} working={busyCounts.working} />
        ) : (
          <>
            <SidebarTools
              signedIn={Boolean(session)}
              mainTab={mainTab}
              onTabChange={setMainTab}
              tabJob={tabJob}
              customTab={customTab}
              activeTabId={activeTabId}
              fillBusy={fillBusy}
              tabWorkBusy={tabWorkBusy}
              onQaStatus={setQaStatus}
              onRemember={() => void rememberFocusedTab()}
            />

            {session ? (
              <div className="sidebar-list-slot" hidden={mainTab !== "custom"}>
                <CustomTabList
                  tabs={customList}
                  pipelines={pipelines}
                  activeTabId={activeTabId}
                  listActive={mainTab === "custom"}
                  onFocus={(tabId) => void focusCustomTab(tabId)}
                  onForget={(tabId) => void forgetCustomTab(tabId)}
                  onPreview={openCustomResumePreview}
                  onContinueGenerate={(tab) =>
                    void startCustomWork(tab.workKind === "recommend" ? "recommend" : "generate", {
                      continue: true,
                      tab,
                    })
                  }
                  onRestartGenerate={(tab) =>
                    void startCustomWork(tab.workKind === "recommend" ? "recommend" : "generate", {
                      continue: false,
                      tab,
                    })
                  }
                  onViewJd={(tab, jd) => setJdPreview({ title: tab.title || "Untitled", text: jd })}
                />
              </div>
            ) : null}

            {session ? (
              <div
                className="sidebar-list-slot"
                hidden={mainTab !== "fill"}
                id="acorn-panel-fill"
                role="tabpanel"
                aria-labelledby="acorn-tab-fill"
              >
                <WorkerPoolList
                  jobs={workerJobs}
                  loading={workerJobsLoading}
                  error={workerJobsError}
                  selectedJobId={tabJob?.jobId ?? null}
                  attachments={attachments}
                  pipelines={pipelines}
                  generates={jobGenerates}
                  openingJobId={openingJobId}
                  markingJobId={markingJobId}
                  listKey={jobsListKey}
                  listActive={mainTab === "fill"}
                  onRefresh={() => void fetchWorkerJobs()}
                  onOpen={(job) => void openWorkerJob(job)}
                  onPreviewResume={openJobResumePreview}
                  onMarkApplied={(job) => void markJobApplied(job)}
                  onContinueGenerate={(job) =>
                    void startJobWork(
                      jobGenerates[job.id]?.workKind === "recommend" ? "recommend" : "generate",
                      { continue: true, job },
                    )
                  }
                  onRestartGenerate={(job) =>
                    void startJobWork(
                      jobGenerates[job.id]?.workKind === "recommend" ? "recommend" : "generate",
                      { continue: false, job },
                    )
                  }
                  onViewJd={(job, jd) => setJdPreview({ title: job.title, text: jd })}
                />
              </div>
            ) : null}

            <div className="sidebar-after">
              {lastFetch ? (
                <AnalyzedTreeSection
                  lastFetch={lastFetch}
                  nodeCount={nodeCount}
                  hasTree={hasTree}
                  hasPlan={Boolean(plan)}
                  onInspect={openInspect}
                />
              ) : null}

              {steps.length > 0 ? (
                <PlanRunSection
                  plan={plan}
                  stepCount={steps.length}
                  stepSummary={stepSummary}
                  fillBusy={fillBusy}
                  visibleSteps={visibleSteps}
                  stepsListRef={stepsListRef}
                  hasMoreSteps={hasMoreSteps}
                  onLoadMore={loadMoreSteps}
                />
              ) : null}
            </div>
          </>
        )}
      </div>

      {preview ? (
        <ResumePreviewPanel
          title={preview.title}
          sourceKey={preview.sourceKey}
          loadHtml={preview.loadHtml}
          downloadFile={preview.downloadFile}
          onClose={() => setPreview(null)}
        />
      ) : null}

      {jdPreview ? (
        <InspectPanel
          title={`Job description · ${jdPreview.title}`}
          lines={jdPreview.text.split("\n")}
          hasMore={false}
          onLoadMore={() => undefined}
          onCopy={() => navigator.clipboard.writeText(jdPreview.text)}
          onClose={() => setJdPreview(null)}
        />
      ) : null}

      {ui.inspect && inspectView ? (
        <InspectPanel
          title={ui.inspect.title}
          lines={inspectView.lines}
          hasMore={inspectView.hasMore}
          onLoadMore={inspectWindow.loadMore}
          onCopy={inspectView.copy}
          onClose={() => {
            if (activeTabId != null) patchTabUi(activeTabId, { inspect: null });
          }}
        />
      ) : null}

      {showActionBar ? (
        <SidebarActionBar
          fillPhase={progress.phase}
          fillLabel={fillLabel}
          generateLabel={generateLabel}
          recommendLabel={recommendLabel}
          fillDisabled={actionsOff}
          generateDisabled={actionsOff || fillLocked}
          recommendDisabled={actionsOff || fillLocked}
          fillTitle={customLocked ? rememberFirst : fillLabel}
          generateTitle={customLocked ? rememberFirst : fillLocked ? openJobFirst : generateLabel}
          recommendTitle={customLocked ? rememberFirst : fillLocked ? openJobFirst : recommendLabel}
          onFill={() => void startPipeline(mainTab === "custom" ? "custom" : "fill")}
          onGenerate={() =>
            void startCustomWork("generate", {
              continue:
                mainTab === "fill"
                  ? fillCanContinue && attachedJobGenerate?.workKind !== "recommend"
                  : customCanContinue && customTab?.workKind !== "recommend",
            })
          }
          onRecommend={() =>
            void startCustomWork("recommend", {
              continue:
                mainTab === "fill"
                  ? fillCanContinue && attachedJobGenerate?.workKind === "recommend"
                  : customCanContinue && customTab?.workKind === "recommend",
            })
          }
        />
      ) : null}

      <ConnectionFooter
        phase={progress.phase}
        connected={connected}
        signedIn={Boolean(session)}
        status={footerStatus}
        apiUrl={apiUrl}
        onApiUrlChange={setApiUrl}
        onOpenChange={setConnectionOpen}
      />
    </div>
  );
}
