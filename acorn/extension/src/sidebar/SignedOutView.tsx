import type { AcornFaceMode } from "@acorn/face";
import { AnalyzedTreeSection } from "./AnalyzedTreeSection";
import { PlanRunSection } from "./PlanRunSection";
import { SignInCard } from "./SignInCard";
import type { PlanInspect, SidebarAuth } from "./sidebar-panel-types";

interface Props {
  authBusy: SidebarAuth["authBusy"];
  handleSignIn: SidebarAuth["handleSignIn"];
  companionMode: AcornFaceMode;
  fillBusy: boolean;
  hasTree: boolean;
  lastFetch: PlanInspect["lastFetch"];
  nodeCount: PlanInspect["nodeCount"];
  plan: PlanInspect["plan"];
  steps: PlanInspect["steps"];
  stepSummary: PlanInspect["stepSummary"];
  visibleSteps: PlanInspect["visibleSteps"];
  stepsListRef: PlanInspect["stepsListRef"];
  hasMoreSteps: PlanInspect["hasMoreSteps"];
  loadMoreSteps: PlanInspect["loadMoreSteps"];
  openInspect: PlanInspect["openInspect"];
}

/** Signed out: the sign-in card, then the last analyzed tree and plan run. */
export function SignedOutView({
  authBusy,
  handleSignIn,
  companionMode,
  fillBusy,
  hasTree,
  lastFetch,
  nodeCount,
  plan,
  steps,
  stepSummary,
  visibleSteps,
  stepsListRef,
  hasMoreSteps,
  loadMoreSteps,
  openInspect,
}: Props) {
  return (
    <main className="sidebar-scroll">
      <SignInCard
        authBusy={authBusy}
        faceMode={companionMode}
        onSignIn={() => void handleSignIn()}
      />
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
    </main>
  );
}
