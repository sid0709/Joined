import type { RefObject } from "react";
import type { ActionPlan, RunStepRecord } from "@acorn/shared/plan-runner/types";
import { LoadMoreFooter } from "./LoadMoreFooter";

type PlanRunSectionProps = {
  plan: ActionPlan | undefined;
  stepCount: number;
  stepSummary: { ok: number; skipped: number; blocked: number; failed: number };
  fillBusy: boolean;
  visibleSteps: RunStepRecord[];
  stepsListRef: RefObject<HTMLDivElement | null>;
  hasMoreSteps: boolean;
  onLoadMore: () => void;
};

/** The running or last Fill plan: step counts and the paged step list. */
export function PlanRunSection({
  plan,
  stepCount,
  stepSummary,
  fillBusy,
  visibleSteps,
  stepsListRef,
  hasMoreSteps,
  onLoadMore,
}: PlanRunSectionProps) {
  return (
    <section className="plan-run">
      <h3>Plan run</h3>
      {plan?.goal && <p className="plan-goal">{plan.goal}</p>}
      <div className="plan-run-summary">
        <span>ok {stepSummary.ok}</span>
        <span>skipped {stepSummary.skipped}</span>
        <span>blocked {stepSummary.blocked}</span>
        <span>failed {stepSummary.failed}</span>
        {fillBusy && <span className="plan-run-live">running…</span>}
      </div>
      <div ref={stepsListRef} className="plan-run-scroll">
        <ul className="plan-run-steps">
          {visibleSteps.map((step) => (
            <li key={step.index} className={`plan-step status-${step.status}`}>
              <span className="plan-step-idx">{step.index + 1}</span>
              <span className="plan-step-action">{step.action}</span>
              <span className="plan-step-status">{stepStatusLabel(step)}</span>
              <span className="plan-step-target">
                {step.element_index != null ? `[${step.element_index}]` : "—"}
                {step.expected_label ? ` ${step.expected_label}` : ""}
              </span>
              {step.message && <span className="plan-step-msg">{step.message}</span>}
            </li>
          ))}
        </ul>
        <LoadMoreFooter
          hasMore={hasMoreSteps}
          onLoadMore={onLoadMore}
          rootRef={stepsListRef}
          label={`Load more (${visibleSteps.length} of ${stepCount})`}
        />
      </div>
    </section>
  );
}

function stepStatusLabel(step: RunStepRecord): string {
  if (step.status === "ok") return "verified";
  return step.status;
}
