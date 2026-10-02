import { useState } from "react";
import type { ActionStep, ActionStepType } from "../automation-types";
import "./ActionBuilderModal.css";

interface Props {
  nodeLabel: string;
  onClose: () => void;
  onRun: (steps: ActionStep[]) => void;
  running: boolean;
}

const STEP_TYPES: { value: ActionStepType; label: string }[] = [
  { value: "focus", label: "Focus" },
  { value: "click", label: "Click" },
  { value: "type", label: "Typing" },
  { value: "wait", label: "Wait" },
  { value: "keydown", label: "Key Down" },
  { value: "keyup", label: "Key Up" },
];

const PRESETS: { name: string; steps: Omit<ActionStep, "id">[] }[] = [
  {
    name: "Focus → type → Enter",
    steps: [
      { type: "focus" },
      { type: "wait", ms: 1000 },
      { type: "type", text: "hello" },
      { type: "wait", ms: 500 },
      { type: "keydown", key: "Enter" },
    ],
  },
];

function newStep(type: ActionStepType = "focus"): ActionStep {
  return {
    id: crypto.randomUUID(),
    type,
    ms: type === "wait" ? 1000 : undefined,
    text: type === "type" ? "" : undefined,
    key: type === "keydown" || type === "keyup" ? "Enter" : undefined,
  };
}

export function ActionBuilderModal({ nodeLabel, onClose, onRun, running }: Props) {
  const [steps, setSteps] = useState<ActionStep[]>([newStep("focus")]);

  const updateStep = (id: string, patch: Partial<ActionStep>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const removeStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    setSteps((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setSteps(preset.steps.map((s) => ({ ...s, id: crypto.randomUUID() })));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel action-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <div>
            <h2>Semi-Automation</h2>
            <p className="modal-subtitle">{nodeLabel}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="preset-row">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              className="preset-btn"
              onClick={() => applyPreset(p)}
            >
              {p.name}
            </button>
          ))}
        </div>

        <div className="steps-list">
          {steps.map((step, index) => (
            <div key={step.id} className="step-row">
              <span className="step-index">{index + 1}</span>
              <select
                value={step.type}
                onChange={(e) => updateStep(step.id, { type: e.target.value as ActionStepType })}
              >
                {STEP_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>

              {step.type === "type" && (
                <input
                  type="text"
                  placeholder="Text to type"
                  value={step.text ?? ""}
                  onChange={(e) => updateStep(step.id, { text: e.target.value })}
                />
              )}

              {step.type === "wait" && (
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={step.ms ?? 1000}
                  onChange={(e) => updateStep(step.id, { ms: Number(e.target.value) })}
                />
              )}

              {(step.type === "keydown" || step.type === "keyup") && (
                <input
                  type="text"
                  placeholder="Key (e.g. Enter, Tab)"
                  value={step.key ?? ""}
                  onChange={(e) => updateStep(step.id, { key: e.target.value })}
                />
              )}

              <div className="step-actions">
                <button type="button" onClick={() => moveStep(index, -1)} disabled={index === 0}>
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveStep(index, 1)}
                  disabled={index === steps.length - 1}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeStep(step.id)}
                  disabled={steps.length === 1}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="add-step-btn"
          onClick={() => setSteps((s) => [...s, newStep()])}
        >
          + Add step
        </button>

        <footer className="modal-footer">
          <button type="button" onClick={onClose} disabled={running}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            disabled={running || steps.length === 0}
            onClick={() => onRun(steps)}
          >
            {running ? "Running…" : "Run actions"}
          </button>
        </footer>
      </div>
    </div>
  );
}
