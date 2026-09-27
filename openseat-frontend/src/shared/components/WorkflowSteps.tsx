import { Card } from "@/src/shared/marketplace-ui";

export type WorkflowStepState = "complete" | "current" | "upcoming" | "locked";

export interface WorkflowStep {
  label: string;
  description: string;
  state: WorkflowStepState;
}

export function WorkflowSteps({
  title = "Workflow",
  meta,
  steps,
}: {
  title?: string;
  meta?: string;
  steps: WorkflowStep[];
}) {
  return (
    <Card title={title} meta={meta}>
      <ol className="marketplace-workflow-steps">
        {steps.map((step, index) => (
          <li
            key={step.label}
            className={`marketplace-workflow-step marketplace-workflow-step-${step.state}`}
          >
            <span className="marketplace-workflow-step-index">{index + 1}</span>
            <span>
              <strong className="body-strong">{step.label}</strong>
              <span className="body-sm text-ink-muted">{step.description}</span>
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
