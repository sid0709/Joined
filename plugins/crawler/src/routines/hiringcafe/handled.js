/** Whether a HiringCafe job should be skipped on this or a later run. */

export function handledIdSet(ids) {
  return new Set((ids ?? []).map((id) => String(id)).filter(Boolean));
}

export function isJobHandled({ id }, handledIds) {
  if (!id) return false;
  return handledIds?.has?.(String(id)) === true;
}

/** Jobs after the resume cursor. The cursor job itself was already decided. */
export function jobsAfterCursor(jobs, lastJobId = "") {
  const resumeId = lastJobId ? String(lastJobId) : "";
  if (!resumeId) return jobs;
  const start = jobs.findIndex((job) => String(job.id) === resumeId);
  if (start < 0) return jobs;
  return jobs.slice(start + 1);
}

export function unhandledJobs(jobs, handledIds, lastJobId = "") {
  return jobsAfterCursor(jobs, lastJobId).filter((job) => !isJobHandled(job, handledIds));
}

export function nextUnhandledJob(jobs, handledIds, lastJobId = "") {
  return unhandledJobs(jobs, handledIds, lastJobId)[0] ?? null;
}
