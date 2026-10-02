import "./PlanRunModal.css";
import type { PauseRequest, RunStepRecord } from "../plan-runner/types";

interface Props {
  goal: string;
  running: boolean;
  steps: RunStepRecord[];
  pause: PauseRequest | null;
  onPauseDecision: (decision: "continue" | "skip" | "abort") => void;
  onClose: () => void;
}

export function PlanRunModal({ goal, running, steps, pause, onPauseDecision, onClose }: Props) {
  const summary = {
    ok: steps.filter((s) => s.status === "ok").length,
    skipped: steps.filter((s) => s.status === "skipped").length,
    blocked: steps.filter((s) => s.status === "blocked").length,
    failed: steps.filter((s) => s.status === "failed" || s.status === "aborted").length,
    paused: steps.filter((s) => s.status === "paused").length,
  };

  return (
    <div className="modal-backdrop" onClick={() => !running && !pause && onClose()}>
      <div className="modal-panel plan-run-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <div>
            <h2>Plan Run</h2>
            <p className="plan-run-goal">{goal}</p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={Boolean(pause) || running}
          >
            ✕
          </button>
        </header>

        {pause && (
          <div className={`plan-pause plan-pause-${pause.kind}`}>
            <div className="plan-pause-title">
              {pause.kind === "planned" ? "Paused for review" : "Step needs attention"}
            </div>
            <div className="plan-pause-meta">
              Step {pause.index + 1}: <code>{pause.action}</code>
              {pause.element_index != null && <> · index {pause.element_index}</>}
              {pause.expected_label && <> · {pause.expected_label}</>}
            </div>
            <p className="plan-pause-reason">{pause.reason}</p>
            <div className="plan-pause-actions">
              <button type="button" className="primary" onClick={() => onPauseDecision("continue")}>
                Continue
              </button>
              <button type="button" onClick={() => onPauseDecision("skip")}>
                Skip
              </button>
              <button type="button" className="danger" onClick={() => onPauseDecision("abort")}>
                Abort
              </button>
            </div>
          </div>
        )}

        <div className="plan-run-summary">
          <span>ok {summary.ok}</span>
          <span>skipped {summary.skipped}</span>
          <span>blocked {summary.blocked}</span>
          <span>failed {summary.failed}</span>
          {running && <span className="plan-run-live">running…</span>}
        </div>

        <ul className="plan-run-steps">
          {steps.map((step) => (
            <li key={step.index} className={`plan-step status-${step.status}`}>
              <span className="plan-step-idx">{step.index + 1}</span>
              <span className="plan-step-action">{step.action}</span>
              <span className="plan-step-target">
                {step.element_index != null ? `[${step.element_index}]` : "—"}
                {step.expected_label ? ` ${step.expected_label}` : ""}
              </span>
              <span className="plan-step-status">{step.status}</span>
              {step.message && <span className="plan-step-msg">{step.message}</span>}
            </li>
          ))}
        </ul>

        <footer className="modal-footer">
          <button
            type="button"
            className="primary"
            onClick={onClose}
            disabled={Boolean(pause) || running}
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
