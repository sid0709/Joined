"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileUploader } from "sid-ui";

import type { Task, TaskPackageLine, TaskType } from "@/src/shared/types/marketplace";

import { estimateSpend, TaskPreview } from "@/src/client/components/tasks/TaskPreview";
import { useHunter } from "@/src/client/context/HunterContext";
import { DateField, NumberField } from "@/src/shared/kit/Fields";
import { PageHeader } from "@/src/shared/kit/PageHeader";
import { Panel } from "@/src/shared/kit/Panel";
import { money } from "@/src/shared/lib/format";
import {
  Badge,
  Banner,
  Button,
  Checkbox,
  Input,
  PageBody,
  TextArea,
} from "@/src/shared/marketplace-ui";
import { isoAhead } from "@/src/shared/mock/clock";
import { HUNTER_ROUTES } from "@/src/shared/routes/hunter";

const STEPS = ["Contract type", "Details", "Packages & rates", "Terms"] as const;
const DEFAULT_SLOTS = "1";
const DEFAULT_DAILY_TARGET = "5";
const DEFAULT_START_OFFSET_DAYS = 2;
const MIN_TITLE_LENGTH = 8;
const MIN_SUMMARY_LENGTH = 30;
const ZIP_ACCEPT = ".zip";
const BYTES_PER_KB = 1024;

const TYPE_CHOICES: { value: TaskType; title: string; body: string }[] = [
  {
    value: "permanent",
    title: "Permanent contract",
    body: "A long-term relationship. You send fresh links on a rhythm and the bidder keeps a daily pace. Best for steady application volume.",
  },
  {
    value: "one_time",
    title: "One-time batch",
    body: "You hand over a zipped set of application links once. The bidder applies to all of them and delivers a completion log.",
  },
];

const dateInput = (iso: string) => iso.slice(0, 10);

export function TaskComposer() {
  const router = useRouter();
  const { packages, createTask } = useHunter();
  const [step, setStep] = useState(0);
  const [type, setType] = useState<TaskType>("permanent");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [requirementsText, setRequirementsText] = useState("");
  const [selected, setSelected] = useState<Record<string, { quota: string; rate: string }>>({});
  const [dailyTarget, setDailyTarget] = useState(DEFAULT_DAILY_TARGET);
  const [slots, setSlots] = useState(DEFAULT_SLOTS);
  const [startsAt, setStartsAt] = useState(dateInput(isoAhead(DEFAULT_START_OFFSET_DAYS)));
  const [endsAt, setEndsAt] = useState(dateInput(isoAhead(DEFAULT_START_OFFSET_DAYS + 6)));
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requirements = requirementsText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const lines: TaskPackageLine[] = Object.entries(selected).map(([packageId, value]) => ({
    packageId,
    quota: Number(value.quota) || 0,
    rate: Number(value.rate) || 0,
  }));
  const links = lines.reduce((sum, line) => sum + line.quota, 0);

  const validate = (current: number): string | null => {
    if (current === 1) {
      if (title.trim().length < MIN_TITLE_LENGTH)
        return `Give the task a descriptive title of at least ${MIN_TITLE_LENGTH} characters.`;
      if (summary.trim().length < MIN_SUMMARY_LENGTH)
        return `Describe the work in at least ${MIN_SUMMARY_LENGTH} characters so bidders can judge it.`;
    }
    if (current === 2) {
      if (!lines.length) return "Choose at least one package.";
      if (lines.some((line) => line.quota < 1 || line.rate <= 0))
        return "Every selected package needs a link quota and a rate above zero.";
    }
    if (current === 3 && type === "one_time" && !file)
      return "Attach the zipped batch of links for this one-time task.";
    return null;
  };

  const next = () => {
    const problem = validate(step);
    setError(problem);
    if (!problem) setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const submit = (status: Extract<Task["status"], "draft" | "open">) => {
    const problem = [1, 2, 3].map(validate).find(Boolean) ?? null;
    if (status === "open" && problem) return setError(problem);
    const id = createTask({
      title: title.trim() || "Untitled draft",
      type,
      status,
      summary: summary.trim(),
      requirements,
      packageLines: lines,
      dailyTarget: Number(dailyTarget) || 1,
      bidderSlots: Math.max(1, Number(slots) || 1),
      budgetCap: Math.ceil(estimateSpend(lines)),
      startsAt: new Date(startsAt).toISOString(),
      endsAt: type === "one_time" ? new Date(endsAt).toISOString() : undefined,
      batchFile:
        type === "one_time" && file
          ? {
              name: file.name,
              sizeKb: Math.max(1, Math.round(file.size / BYTES_PER_KB)),
              linkCount: links,
            }
          : undefined,
    });
    router.push(HUNTER_ROUTES.task(id));
  };

  const togglePackage = (packageId: string, rate: number, on: boolean) =>
    setSelected((current) => {
      const copy = { ...current };
      if (on)
        copy[packageId] = { quota: type === "permanent" ? "20" : "30", rate: rate.toFixed(2) };
      else delete copy[packageId];
      return copy;
    });

  const patchLine = (packageId: string, patch: Partial<{ quota: string; rate: string }>) =>
    setSelected((current) => ({ ...current, [packageId]: { ...current[packageId], ...patch } }));

  return (
    <PageBody>
      <div className="hx-page">
        <PageHeader
          back={{ href: HUNTER_ROUTES.tasks, label: "All tasks" }}
          eyebrow="New task"
          title="Post a task for bidders"
          description="Bidders will see this on the task board and contact you in chat. You choose who to connect with, then assign links from the pool."
        />

        <ol className="hx-steps" aria-label="Task setup steps">
          {STEPS.map((label, index) => (
            <li
              key={label}
              className="hx-step"
              data-state={index === step ? "current" : index < step ? "done" : "todo"}
            >
              <span className="hx-step-index">{index < step ? "✓" : index + 1}</span>
              {label}
            </li>
          ))}
        </ol>

        <div className="hx-split">
          <div className="hx-stack">
            {error && <Banner tone="danger" title={error} />}

            {step === 0 && (
              <Panel
                title="What kind of relationship do you want?"
                subtitle="This shapes how the task is priced and monitored"
              >
                <div className="hx-grid hx-grid-2">
                  {TYPE_CHOICES.map((choice) => (
                    <button
                      key={choice.value}
                      type="button"
                      className="hx-choice"
                      aria-pressed={type === choice.value}
                      onClick={() => setType(choice.value)}
                    >
                      <strong className="hx-panel-title">{choice.title}</strong>
                      <span className="hx-muted">{choice.body}</span>
                    </button>
                  ))}
                </div>
              </Panel>
            )}

            {step === 1 && (
              <Panel title="Describe the work" subtitle="Clear briefs attract better bidders">
                <div className="hx-inline-form">
                  <Input
                    label="Task title"
                    placeholder="e.g. Weekly Greenhouse coverage · Product & Operations"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                  <TextArea
                    label="What will the bidder do?"
                    placeholder="Which roles, which resume, how often you will send links, and what a good result looks like."
                    value={summary}
                    onChange={(event) => setSummary(event.target.value)}
                  />
                  <TextArea
                    label="Requirements (one per line)"
                    placeholder={"Fluent written English\nScreenshot of every confirmation page"}
                    value={requirementsText}
                    onChange={(event) => setRequirementsText(event.target.value)}
                  />
                </div>
              </Panel>
            )}

            {step === 2 && (
              <Panel
                title="Choose packages and agree rates"
                subtitle="Harder application systems cost more per link. You can adjust each rate for this task."
              >
                <div className="hx-stack">
                  {packages.map((tier) => {
                    const line = selected[tier.id];
                    return (
                      <div
                        key={tier.id}
                        className="hx-contact"
                        style={{ borderStyle: line ? "solid" : "dashed" }}
                      >
                        <div className="hx-row hx-row-between">
                          <Checkbox
                            checked={Boolean(line)}
                            label={tier.name}
                            onChange={(event) =>
                              togglePackage(tier.id, tier.ratePerLink, event.target.checked)
                            }
                          />
                          <span className="hx-row">
                            <Badge
                              label={tier.difficulty}
                              tone={
                                tier.difficulty === "Easy"
                                  ? "success"
                                  : tier.difficulty === "Advanced"
                                    ? "error"
                                    : "warning"
                              }
                            />
                            <span className="hx-small hx-muted">
                              List rate {money(tier.ratePerLink)}
                            </span>
                          </span>
                        </div>
                        <p className="hx-small hx-muted" style={{ margin: "var(--space-2) 0 0" }}>
                          {tier.description} Covers {tier.ats.join(", ")} · about{" "}
                          {tier.minutesPerLink} min per link · {tier.turnaround}.
                        </p>
                        {line && (
                          <div className="hx-field-grid" style={{ marginTop: "var(--space-3)" }}>
                            <NumberField
                              label={type === "permanent" ? "Links per week" : "Links in batch"}
                              value={line.quota}
                              onChange={(value) => patchLine(tier.id, { quota: value })}
                            />
                            <NumberField
                              label="Rate per link (USD)"
                              step={0.05}
                              value={line.rate}
                              onChange={(value) => patchLine(tier.id, { rate: value })}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Panel>
            )}

            {step === 3 && (
              <Panel title="Set the terms" subtitle="Pace, capacity, and timing">
                <div className="hx-inline-form">
                  <div className="hx-field-grid">
                    <NumberField
                      label="Daily target (links)"
                      value={dailyTarget}
                      onChange={setDailyTarget}
                    />
                    <NumberField
                      label="Bidder slots"
                      helper="How many bidders can connect to this task"
                      value={slots}
                      onChange={setSlots}
                    />
                    <DateField label="Start date" value={startsAt} onChange={setStartsAt} />
                    {type === "one_time" && (
                      <DateField label="Deliver by" value={endsAt} onChange={setEndsAt} />
                    )}
                  </div>
                  {type === "one_time" && (
                    <FileUploader
                      label="Zipped batch of links"
                      description="One file with every application link for this batch"
                      accept={ZIP_ACCEPT}
                      isMultiple={false}
                      maxFiles={1}
                      variant="dropzone"
                      onChange={(files) => setFile(files[0] ?? null)}
                    />
                  )}
                </div>
              </Panel>
            )}

            <div className="hx-row hx-row-between">
              <Button
                variant="ghost"
                label="Back"
                disabled={step === 0}
                onClick={() => setStep((current) => Math.max(0, current - 1))}
              />
              <div className="hx-row">
                <Button variant="secondary" label="Save as draft" onClick={() => submit("draft")} />
                {step < STEPS.length - 1 ? (
                  <Button variant="primary" label="Continue" onClick={next} />
                ) : (
                  <Button
                    variant="primary"
                    label="Publish to task board"
                    onClick={() => submit("open")}
                  />
                )}
              </div>
            </div>
          </div>

          <TaskPreview
            type={type}
            title={title}
            summary={summary}
            requirements={requirements}
            lines={lines}
            dailyTarget={Number(dailyTarget) || 0}
            bidderSlots={Number(slots) || 1}
          />
        </div>
      </div>
    </PageBody>
  );
}
