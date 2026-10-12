import { SCRAPE_SOURCE } from "../config/env.js";

/** Server cap: at most 50 jobs per crawler ingest request. */
export const INGEST_BATCH_MAX_JOBS = 50;
/** Server cap: 4 MiB request body. */
export const INGEST_BATCH_MAX_BYTES = 4 * 1024 * 1024;

const encoder = new TextEncoder();

export function utf8ByteLength(value) {
  return encoder.encode(typeof value === "string" ? value : JSON.stringify(value)).length;
}

export function ingestBodyBytes(jobs, createdBy = SCRAPE_SOURCE) {
  return utf8ByteLength({ createdBy, jobs });
}

/**
 * Pack jobs into ingest requests that honour the 50-job and 4 MiB caps.
 * A single job larger than the body cap is sent alone.
 */
export function splitIngestBatches(
  items,
  {
    maxJobs = INGEST_BATCH_MAX_JOBS,
    maxBytes = INGEST_BATCH_MAX_BYTES,
    createdBy = SCRAPE_SOURCE,
  } = {},
) {
  const batches = [];
  let current = [];
  for (const item of items ?? []) {
    const job = item?.job ?? item;
    const nextJobs = [...current.map((entry) => entry.job ?? entry), job];
    const overCount = current.length >= maxJobs;
    const overBytes = ingestBodyBytes(nextJobs, createdBy) > maxBytes;
    if (current.length && (overCount || overBytes)) {
      batches.push(current);
      current = [];
    }
    current.push(item);
  }
  if (current.length) batches.push(current);
  return batches;
}
