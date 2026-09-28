"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { TEMP_JOBS_PATH, tempJobPatchFrom, type TempJob, type TempJobPatch } from "@/lib/jobs";

const inputClass =
  "h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-ink";
const textareaClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink";
const labelClass = "flex flex-col gap-1 text-sm";
const labelTextClass = "text-xs font-medium text-muted";

export function JobDetailDrawer({
  jobId,
  onClose,
  onSaved,
}: {
  jobId: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  return <JobDetail key={jobId} jobId={jobId} onClose={onClose} onSaved={onSaved} />;
}

function JobDetail({
  jobId,
  onClose,
  onSaved,
}: {
  jobId: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [job, setJob] = useState<TempJob | null>(null);
  const [draft, setDraft] = useState<TempJobPatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    adminFetch<{ job: TempJob }>(`${TEMP_JOBS_PATH}/${jobId}`, { signal: controller.signal })
      .then((body) => {
        if (controller.signal.aborted) return;
        setJob(body.job);
        setDraft(tempJobPatchFrom(body.job));
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Could not load job");
      });
    return () => controller.abort();
  }, [jobId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const set =
    <K extends keyof TempJobPatch>(key: K) =>
    (value: TempJobPatch[K]) => {
      setSaved(false);
      setDraft((current) => (current ? { ...current, [key]: value } : current));
    };

  async function save() {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      const body = await adminFetch<{ job: TempJob }>(`${TEMP_JOBS_PATH}/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      setJob(body.job);
      setDraft(tempJobPatchFrom(body.job));
      setSaved(true);
      onSaved?.();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "Could not save job");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-ink/40" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="temp-job-title"
        className="flex h-full w-full max-w-xl flex-col bg-surface shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs text-muted">Temp job</p>
            <h2 id="temp-job-title" className="mt-1 text-lg font-semibold leading-6 tracking-tight">
              {draft?.title || (error ? "Job" : "Loading job")}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={!draft || saving}
              className="h-9 rounded-lg bg-ink px-4 text-sm font-medium text-surface disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2 py-1 text-sm text-muted hover:bg-paper hover:text-ink"
            >
              Close
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {!draft && !error ? <div className="h-40 animate-pulse rounded-lg bg-paper" /> : null}
          {saveError ? (
            <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
              {saveError}
            </p>
          ) : null}
          {saved ? (
            <p className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
              Job saved. If this listing was already analyzed, the public job was updated too.
            </p>
          ) : null}
          {draft && job ? (
            <div className="flex flex-col gap-6">
              <p className="text-xs leading-5 text-muted">
                Fix fields the scrape missed. Location, workplace, level, employment, and pay hints
                update the public job when one exists. Summary, skills, and bullets are edited on
                Jobs.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label className={`${labelClass} col-span-2`}>
                  <span className={labelTextClass}>Title</span>
                  <input
                    className={inputClass}
                    value={draft.title}
                    onChange={(event) => set("title")(event.target.value)}
                  />
                </label>
                <label className={labelClass}>
                  <span className={labelTextClass}>Company</span>
                  <input
                    className={inputClass}
                    value={draft.companyName}
                    onChange={(event) => set("companyName")(event.target.value)}
                  />
                </label>
                <label className={labelClass}>
                  <span className={labelTextClass}>Company link</span>
                  <input
                    className={inputClass}
                    value={draft.companyLink}
                    onChange={(event) => set("companyLink")(event.target.value)}
                  />
                </label>
                <label className={`${labelClass} col-span-2`}>
                  <span className={labelTextClass}>Logo URL</span>
                  <input
                    className={inputClass}
                    value={draft.companyLogo}
                    onChange={(event) => set("companyLogo")(event.target.value)}
                  />
                </label>
                <label className={`${labelClass} col-span-2`}>
                  <span className={labelTextClass}>Apply link</span>
                  <input
                    className={inputClass}
                    value={draft.applyLink}
                    onChange={(event) => set("applyLink")(event.target.value)}
                  />
                </label>
                <label className={labelClass}>
                  <span className={labelTextClass}>Location</span>
                  <input
                    className={inputClass}
                    value={draft.location}
                    onChange={(event) => set("location")(event.target.value)}
                  />
                </label>
                <label className={labelClass}>
                  <span className={labelTextClass}>Workplace</span>
                  <input
                    className={inputClass}
                    value={draft.remote}
                    placeholder="Remote, hybrid, or onsite"
                    onChange={(event) => set("remote")(event.target.value)}
                  />
                </label>
                <label className={labelClass}>
                  <span className={labelTextClass}>Level</span>
                  <input
                    className={inputClass}
                    value={draft.seniority}
                    placeholder="Senior, staff, manager"
                    onChange={(event) => set("seniority")(event.target.value)}
                  />
                </label>
                <label className={labelClass}>
                  <span className={labelTextClass}>Employment</span>
                  <input
                    className={inputClass}
                    value={draft.time}
                    placeholder="Full-time, contract, part-time"
                    onChange={(event) => set("time")(event.target.value)}
                  />
                </label>
                <label className={`${labelClass} col-span-2`}>
                  <span className={labelTextClass}>Salary</span>
                  <input
                    className={inputClass}
                    value={draft.salary}
                    placeholder="$120K - $150K a year"
                    onChange={(event) => set("salary")(event.target.value)}
                  />
                </label>
              </div>

              <label className={labelClass}>
                <span className={labelTextClass}>Description</span>
                <textarea
                  className={textareaClass}
                  rows={8}
                  value={draft.description}
                  onChange={(event) => set("description")(event.target.value)}
                />
              </label>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Fact label="Review" value={job.titleReviewLabel} />
                <Fact
                  label="Source"
                  value={[job.sourceCatalog, job.source].filter(Boolean).join(" · ")}
                />
                <Fact label="Created by" value={job.createdBy} />
                <Fact label="Posted" value={formatDate(job.postedAt)} />
                <Fact label="Updated" value={formatDate(job.updatedAt)} />
              </dl>

              {job.aiSkills && job.aiSkills.length > 0 ? (
                <div>
                  <h3 className="text-sm font-medium">Extracted skills</h3>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {job.aiSkills.map((skill) => (
                      <li
                        key={`${skill.name}-${skill.category}`}
                        className="rounded-full bg-paper px-2.5 py-1 text-xs text-ink"
                        title={skill.category}
                      >
                        {skill.name}
                        {skill.requirement != null ? ` ${skill.requirement}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function Fact({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 break-words">{value || "—"}</dd>
    </div>
  );
}
