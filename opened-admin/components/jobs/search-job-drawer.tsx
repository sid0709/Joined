"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/api";
import { formatCount } from "@/lib/format";
import {
  EMPLOYMENTS,
  PAY_PERIODS,
  SEARCH_JOBS_PATH,
  SENIORITIES,
  WORKPLACES,
  searchJobPatchFrom,
  type SearchJobPatch,
  type SearchRecord,
} from "@/lib/search-job";

const inputClass =
  "h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-ink";
const textareaClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink";
const labelClass = "flex flex-col gap-1 text-sm";
const labelTextClass = "text-xs font-medium text-muted";

export function SearchJobDrawer({
  tempJobId,
  onClose,
  onSaved,
}: {
  tempJobId: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  return (
    <SearchJobDetail key={tempJobId} tempJobId={tempJobId} onClose={onClose} onSaved={onSaved} />
  );
}

function SearchJobDetail({
  tempJobId,
  onClose,
  onSaved,
}: {
  tempJobId: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [record, setRecord] = useState<SearchRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<SearchJobPatch | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [resetToken, setResetToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    adminFetch<SearchRecord>(`${SEARCH_JOBS_PATH}/${tempJobId}`, { signal: controller.signal })
      .then((body) => {
        if (controller.signal.aborted) return;
        setRecord(body);
        setDraft(searchJobPatchFrom(body));
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Could not load job");
      });
    return () => controller.abort();
  }, [tempJobId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const set =
    <K extends keyof SearchJobPatch>(key: K) =>
    (value: SearchJobPatch[K]) => {
      setSaved(false);
      setDraft((current) => (current ? { ...current, [key]: value } : current));
    };
  const setPay =
    <K extends keyof SearchJobPatch["pay"]>(key: K) =>
    (value: SearchJobPatch["pay"][K]) => {
      setSaved(false);
      setDraft((current) =>
        current ? { ...current, pay: { ...current.pay, [key]: value } } : current,
      );
    };

  async function save() {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await adminFetch<SearchRecord>(`${SEARCH_JOBS_PATH}/${tempJobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      setRecord(updated);
      setDraft(searchJobPatchFrom(updated));
      setResetToken((token) => token + 1);
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
        aria-labelledby="search-job-title"
        className="flex h-full w-full max-w-xl flex-col bg-surface shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs text-muted">Search record</p>
            <h2
              id="search-job-title"
              className="mt-1 text-lg font-semibold leading-6 tracking-tight"
            >
              {draft?.title ?? (error ? "Job" : "Loading job")}
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
              Job saved
            </p>
          ) : null}
          {draft && record ? (
            <div className="flex flex-col gap-6">
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
                    value={draft.company}
                    onChange={(event) => set("company")(event.target.value)}
                  />
                </label>
                <label className={labelClass}>
                  <span className={labelTextClass}>Team</span>
                  <input
                    className={inputClass}
                    value={draft.team}
                    onChange={(event) => set("team")(event.target.value)}
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
                  <select
                    className={inputClass}
                    value={draft.workplace}
                    onChange={(event) =>
                      set("workplace")(event.target.value as SearchJobPatch["workplace"])
                    }
                  >
                    {WORKPLACES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  <span className={labelTextClass}>Level</span>
                  <select
                    className={inputClass}
                    value={draft.seniority}
                    onChange={(event) =>
                      set("seniority")(event.target.value as SearchJobPatch["seniority"])
                    }
                  >
                    {SENIORITIES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  <span className={labelTextClass}>Employment</span>
                  <select
                    className={inputClass}
                    value={draft.employment}
                    onChange={(event) =>
                      set("employment")(event.target.value as SearchJobPatch["employment"])
                    }
                  >
                    {EMPLOYMENTS.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.visa}
                    onChange={(event) => set("visa")(event.target.checked)}
                    className="size-4 accent-ink"
                  />
                  Visa sponsorship
                </label>
                <label className={labelClass}>
                  <span className={labelTextClass}>Apply link</span>
                  <input
                    className={inputClass}
                    value={draft.applyLink}
                    onChange={(event) => set("applyLink")(event.target.value)}
                  />
                </label>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <label className={labelClass}>
                  <span className={labelTextClass}>Pay min</span>
                  <input
                    type="number"
                    className={inputClass}
                    value={draft.pay.min}
                    onChange={(event) => setPay("min")(Number(event.target.value))}
                  />
                </label>
                <label className={labelClass}>
                  <span className={labelTextClass}>Pay max</span>
                  <input
                    type="number"
                    className={inputClass}
                    value={draft.pay.max}
                    onChange={(event) => setPay("max")(Number(event.target.value))}
                  />
                </label>
                <label className={labelClass}>
                  <span className={labelTextClass}>Currency</span>
                  <input
                    className={inputClass}
                    value={draft.pay.currency}
                    maxLength={3}
                    onChange={(event) => setPay("currency")(event.target.value.toUpperCase())}
                  />
                </label>
                <label className={labelClass}>
                  <span className={labelTextClass}>Period</span>
                  <select
                    className={inputClass}
                    value={draft.pay.period}
                    onChange={(event) =>
                      setPay("period")(event.target.value as SearchJobPatch["pay"]["period"])
                    }
                  >
                    {PAY_PERIODS.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {draft.pay.min === 0 && draft.pay.max === 0 ? (
                <p className="-mt-4 text-xs text-muted">
                  Pay not listed — left as 0 unless the description gives a real number.
                </p>
              ) : null}

              <label className={labelClass}>
                <span className={labelTextClass}>Summary</span>
                <textarea
                  className={textareaClass}
                  rows={3}
                  value={draft.summary}
                  onChange={(event) => set("summary")(event.target.value)}
                />
              </label>

              <ListField
                key={`skills-${resetToken}`}
                label="Skills"
                value={draft.skills}
                onChange={set("skills")}
                placeholder="One skill per line"
              />
              <ListField
                key={`responsibilities-${resetToken}`}
                label="Responsibilities"
                value={draft.responsibilities}
                onChange={set("responsibilities")}
                placeholder="One responsibility per line"
              />
              <ListField
                key={`requirements-${resetToken}`}
                label="Requirements"
                value={draft.requirements}
                onChange={set("requirements")}
                placeholder="One requirement per line"
              />
              <ListField
                key={`benefits-${resetToken}`}
                label="Benefits"
                value={draft.benefits}
                onChange={set("benefits")}
                placeholder="One benefit per line"
              />

              <p className="text-xs text-muted">
                {record.model} · {formatCount(record.job.postedHoursAgo)}h ago
              </p>

              <details>
                <summary className="cursor-pointer text-sm font-medium text-muted">
                  Raw JSON
                </summary>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-paper p-3 font-mono text-xs leading-5 text-ink">
                  {JSON.stringify(record.job, null, 2)}
                </pre>
              </details>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

/**
 * One item per line. Kept as its own uncontrolled-feeling text buffer (not
 * derived straight from `value.join("\n")` on every keystroke) so a blank
 * line while typing a new item doesn't get silently stripped back out from
 * under the cursor — the list is only cleaned (trimmed, empties dropped) when
 * it leaves the field, on blur.
 */
function ListField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
}) {
  const [text, setText] = useState(() => value.join("\n"));

  return (
    <label className={labelClass}>
      <span className={labelTextClass}>{label}</span>
      <textarea
        className={textareaClass}
        rows={Math.min(8, Math.max(3, value.length + 1))}
        value={text}
        placeholder={placeholder}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          const cleaned = text
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
          setText(cleaned.join("\n"));
          onChange(cleaned);
        }}
      />
    </label>
  );
}
