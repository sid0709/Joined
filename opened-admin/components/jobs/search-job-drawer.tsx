"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/api";
import { formatCount } from "@/lib/format";
import { SEARCH_JOBS_PATH, type SearchJob, type SearchRecord } from "@/lib/search-job";

export function SearchJobDrawer({
  tempJobId,
  onClose,
}: {
  tempJobId: string;
  onClose: () => void;
}) {
  return <SearchJobDetail key={tempJobId} tempJobId={tempJobId} onClose={onClose} />;
}

function SearchJobDetail({ tempJobId, onClose }: { tempJobId: string; onClose: () => void }) {
  const [record, setRecord] = useState<SearchRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    adminFetch<SearchRecord>(`${SEARCH_JOBS_PATH}/${tempJobId}`, { signal: controller.signal })
      .then((body) => {
        if (!controller.signal.aborted) setRecord(body);
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

  const job = record?.job;

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
              {job?.title ?? (error ? "Job" : "Loading job")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-muted hover:bg-paper hover:text-ink"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {!job && !error ? <div className="h-40 animate-pulse rounded-lg bg-paper" /> : null}
          {job && record ? (
            <div className="flex flex-col gap-6">
              <div>
                <p className="font-medium">{job.company}</p>
                <p className="text-sm text-muted">
                  {[job.location, labelWorkplace(job.workplace), job.seniority, job.employment]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="mt-1 text-sm">{formatSearchPay(job)}</p>
              </div>
              {job.summary ? <p className="text-sm leading-6">{job.summary}</p> : null}
              <BulletList title="Responsibilities" items={job.responsibilities} />
              <BulletList title="Requirements" items={job.requirements} />
              <BulletList title="Benefits" items={job.benefits} />
              {job.skills.length > 0 ? (
                <div>
                  <h3 className="text-sm font-medium">Skills</h3>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {job.skills.map((skill) => (
                      <li key={skill} className="rounded-full bg-paper px-2.5 py-1 text-xs">
                        {skill}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="text-xs text-muted">
                {record.model} · {formatCount(job.postedHoursAgo)}h ago
              </p>
              <div>
                <h3 className="text-sm font-medium">JSON for job search</h3>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-paper p-3 font-mono text-xs leading-5 text-ink">
                  {JSON.stringify(job, null, 2)}
                </pre>
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function BulletList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-medium">{title}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function labelWorkplace(value: SearchJob["workplace"]) {
  if (value === "remote") return "Remote";
  if (value === "hybrid") return "Hybrid";
  return "On-site";
}

function formatSearchPay(job: SearchJob) {
  if (job.pay.min === 0 && job.pay.max === 0) return "Pay not listed";
  const amount = (value: number) =>
    job.pay.period === "hour" ? `${value}` : `${Math.round(value / 1000)}k`;
  const range = `${job.pay.currency} ${amount(job.pay.min)}–${amount(job.pay.max)}`;
  return job.pay.period === "hour" ? `${range}/hr` : range;
}
