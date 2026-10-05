import { extractForBoard } from "./extractors";
import {
  BAMBOOHR_HOST_SUFFIX,
  RECRUITEE_HOST_SUFFIX,
  companyFromHostPrefix,
  detectJobBoard,
  firstPathSegment,
  icimsCompanyFromHost,
  jobviteCompanyFromUrl,
  workdayCompanyFromHost,
  workableCompanyFromUrl,
} from "./hosts";
import { extractJsonLdJob } from "./jsonld";
import type { PageRoot } from "./page";
import { isJobBoard, type CapturedJob, type ExtractedFields, type JobBoard } from "./types";

export function boardCompanyFallback(board: JobBoard, url: URL): string {
  switch (board) {
    case "greenhouse":
    case "lever":
    case "ashby":
    case "smartrecruiters":
      return firstPathSegment(url.pathname);
    case "jobvite":
      return jobviteCompanyFromUrl(url);
    case "workable":
      return workableCompanyFromUrl(url);
    case "workday":
      return workdayCompanyFromHost(url.hostname) || firstPathSegment(url.pathname);
    case "icims":
      return icimsCompanyFromHost(url.hostname) || firstPathSegment(url.pathname);
    case "bamboohr":
      return (
        companyFromHostPrefix(url.hostname, BAMBOOHR_HOST_SUFFIX) || firstPathSegment(url.pathname)
      );
    case "recruitee":
      return (
        companyFromHostPrefix(url.hostname, RECRUITEE_HOST_SUFFIX) || firstPathSegment(url.pathname)
      );
    case "linkedin":
    case "unknown":
      return "";
    default: {
      const _exhaustive: never = board;
      return _exhaustive;
    }
  }
}

export function mergeExtractedFields(
  primary: ExtractedFields,
  fallback: ExtractedFields,
): ExtractedFields {
  return {
    title: primary.title || fallback.title,
    company: primary.company || fallback.company,
    location: primary.location || fallback.location,
    applyUrl: primary.applyUrl || fallback.applyUrl,
    description: primary.description || fallback.description,
  };
}

export function toCapturedJob(
  board: JobBoard,
  fields: ExtractedFields,
  pageUrl: string,
): CapturedJob | null {
  const title = fields.title?.trim() ?? "";
  if (!title) {
    return null;
  }
  return {
    board,
    title,
    company: fields.company?.trim() ?? "",
    location: fields.location?.trim() ?? "",
    applyUrl: fields.applyUrl?.trim() || pageUrl,
    description: fields.description?.trim() ?? "",
  };
}

export function parseCapturedJob(value: unknown): CapturedJob | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const job = value as Record<string, unknown>;
  if (!isJobBoard(job.board)) {
    return null;
  }
  if (typeof job.title !== "string" || job.title.trim() === "") {
    return null;
  }
  if (typeof job.company !== "string") {
    return null;
  }
  if (typeof job.location !== "string") {
    return null;
  }
  if (typeof job.applyUrl !== "string") {
    return null;
  }
  if (typeof job.description !== "string") {
    return null;
  }
  return {
    board: job.board,
    title: job.title,
    company: job.company,
    location: job.location,
    applyUrl: job.applyUrl,
    description: job.description,
  };
}

export function parseCapturedJobResponse(value: unknown): CapturedJob | null {
  if (typeof value !== "object" || value === null || !("job" in value)) {
    return null;
  }
  return parseCapturedJob(value.job);
}

export function captureJob(root: PageRoot, pageUrl: string): CapturedJob | null {
  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    return null;
  }

  const board = detectJobBoard(pageUrl, root);
  const extracted = extractForBoard(board, root, url);
  const jsonld = extractJsonLdJob(root) ?? {};
  const merged = mergeExtractedFields(extracted, jsonld);
  if (!merged.company) {
    merged.company = boardCompanyFallback(board, url);
  }
  return toCapturedJob(board, merged, url.href);
}
