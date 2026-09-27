"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/api";
import { formatDate, jobLocation } from "@/lib/format";
import { TEMP_JOBS_PATH, type TempJob } from "@/lib/jobs";
import { CompanyMark } from "@/components/jobs/company-mark";

export function JobDetailDrawer({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  return <JobDetail key={jobId} jobId={jobId} onClose={onClose} />;
}

function JobDetail({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const [job, setJob] = useState<TempJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    adminFetch<{ job: TempJob }>(`${TEMP_JOBS_PATH}/${jobId}`, { signal: controller.signal })
      .then((body) => {
        if (!controller.signal.aborted) setJob(body.job);
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

  const details = job?.metadata?.details;

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
          {job ? (
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-3">
                <CompanyMark name={job.companyName} logo={job.metadata?.companyLogo} />
                <div className="min-w-0">
                  {job.companyLink ? (
                    <a
                      href={job.companyLink}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium hover:underline"
                    >
                      {job.companyName || "Company"}
                    </a>
                  ) : (
                    <p className="font-medium">{job.companyName || "Company"}</p>
                  )}
                  <p className="text-sm text-muted">{jobLocation(job) || "Location not set"}</p>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Fact label="Review" value={job.titleReviewLabel} />
                <Fact
                  label="Source"
                  value={[job.sourceCatalog, job.source].filter(Boolean).join(" · ")}
                />
                <Fact label="Posted" value={formatDate(job.postedAt)} />
                <Fact label="Seniority" value={details?.seniority} />
                <Fact label="Type" value={details?.time} />
                <Fact label="Salary" value={details?.salary} />
                <Fact label="Skills" value={job.aiSkillStatus} />
                <Fact label="Updated" value={formatDate(job.updatedAt)} />
              </dl>

              {job.applyLink ? (
                <a
                  href={job.applyLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-ink px-4 text-sm font-medium text-surface"
                >
                  Open apply link
                </a>
              ) : null}

              {job.metadata?.titleReview?.reason ? (
                <p className="rounded-lg bg-paper px-3 py-2 text-sm leading-6 text-muted">
                  {job.metadata.titleReview.reason}
                </p>
              ) : null}

              {job.aiSkills && job.aiSkills.length > 0 ? (
                <div>
                  <h3 className="text-sm font-medium">Skills</h3>
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

              {job.description ? (
                <div>
                  <h3 className="text-sm font-medium">Description</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">
                    {job.description}
                  </p>
                </div>
              ) : null}

              <dl className="grid gap-2 border-t border-line pt-4 text-xs text-muted">
                <Fact label="Id" value={job._id} />
                <Fact label="Created by" value={job.createdBy} />
                <Fact label="Schema" value={job.model_schema_code} />
              </dl>
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
