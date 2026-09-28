import { ATS_HOST_SUFFIXES, JOB_BOARD_HOSTS } from "./config";
import type { PrecheckResult, Submission } from "./types";

const ACTIVE_STATUSES = new Set(["submitted", "auto_checking", "needs_review", "approved"]);

export function normalizeUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function canonicalUrl(raw: string) {
  const url = new URL(normalizeUrl(raw));
  url.hash = "";
  url.search = "";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.toString();
}

export function hostOf(raw: string) {
  return new URL(canonicalUrl(raw)).hostname;
}

function matchesHost(host: string, suffix: string) {
  return host === suffix || host.endsWith(`.${suffix}`);
}

export function isJobBoardHost(host: string) {
  return JOB_BOARD_HOSTS.some((suffix) => matchesHost(host, suffix));
}

export function isAtsHost(host: string) {
  return ATS_HOST_SUFFIXES.some((suffix) => matchesHost(host, suffix));
}

export function findDuplicate(
  url: string,
  submissions: Pick<Submission, "id" | "canonicalUrl" | "status">[],
) {
  const canonical = canonicalUrl(url);
  return (
    submissions.find(
      (item) => item.canonicalUrl === canonical && ACTIVE_STATUSES.has(item.status),
    ) ?? null
  );
}

export function precheckUrl(
  raw: string,
  submissions: Pick<Submission, "id" | "canonicalUrl" | "status">[] = [],
): PrecheckResult {
  try {
    const url = normalizeUrl(raw);
    const canonical = canonicalUrl(url);
    const host = hostOf(url);
    const jobBoard = isJobBoardHost(host);
    const ats = isAtsHost(host);
    const duplicate = findDuplicate(url, submissions);
    const official = !jobBoard;
    const reachable = Boolean(host);
    const reason = jobBoard
      ? "not an official source"
      : duplicate
        ? "duplicate of an active submission"
        : official
          ? ats
            ? "Official ATS host"
            : "Company career domain"
          : "not an official source";
    return {
      url,
      canonicalUrl: canonical,
      reachable,
      official,
      duplicateOf: duplicate?.id ?? null,
      host,
      ats,
      jobBoard,
      reason,
    };
  } catch {
    return {
      url: raw,
      canonicalUrl: "",
      reachable: false,
      official: false,
      duplicateOf: null,
      host: "",
      ats: false,
      jobBoard: false,
      reason: "Enter a valid http(s) URL",
    };
  }
}
