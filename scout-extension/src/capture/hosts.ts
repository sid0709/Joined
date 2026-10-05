import { firstMatching, type PageRoot } from "./page";
import type { JobBoard, KnownJobBoard } from "./types";

export const GREENHOUSE_HOSTS = ["boards.greenhouse.io", "job-boards.greenhouse.io"] as const;
export const LEVER_HOSTS = ["jobs.lever.co"] as const;
export const ASHBY_HOSTS = ["jobs.ashbyhq.com"] as const;
export const WORKDAY_HOST_SUFFIX = "myworkdayjobs.com";
export const LINKEDIN_HOSTS = ["linkedin.com"] as const;
export const LINKEDIN_JOB_PATH = "/jobs/";
export const SMARTRECRUITERS_HOSTS = [
  "jobs.smartrecruiters.com",
  "careers.smartrecruiters.com",
] as const;
export const ICIMS_HOST_SUFFIX = "icims.com";
export const WORKABLE_HOSTS = ["apply.workable.com"] as const;
export const WORKABLE_HOST_SUFFIX = "workable.com";
export const BAMBOOHR_HOST_SUFFIX = "bamboohr.com";
export const BAMBOOHR_CAREERS_PATH = "/careers";
export const BAMBOOHR_JOBS_PATH = "/jobs";
export const JOBVITE_HOSTS = ["jobs.jobvite.com"] as const;
export const JOBVITE_HOST_SUFFIX = "jobvite.com";
export const RECRUITEE_HOST_SUFFIX = "recruitee.com";
export const MARKETING_HOST_LABELS = ["www", "app", "hire", "support"] as const;

export const GREENHOUSE_DOM_SELECTORS = ["h1.app-title", ".app-title", "#app_body"] as const;
export const LEVER_DOM_SELECTORS = [".posting-headline", ".posting-categories"] as const;
export const ASHBY_DOM_SELECTORS = ['[class*="ashby-job-posting-heading"]'] as const;
export const WORKDAY_DOM_SELECTORS = ['[data-automation-id="jobPostingHeader"]'] as const;
export const LINKEDIN_DOM_SELECTORS = [
  ".jobs-unified-top-card__job-title",
  ".job-details-jobs-unified-top-card__job-title",
] as const;
export const SMARTRECRUITERS_DOM_SELECTORS = [
  "#st-jobDescription",
  '[data-test="job-title"]',
] as const;
export const ICIMS_DOM_SELECTORS = [".iCIMS_JobContent", "h1.iCIMS_Header"] as const;
export const WORKABLE_DOM_SELECTORS = [
  '[data-ui="job-description"]',
  '[data-ui="job-title"]',
] as const;
export const BAMBOOHR_DOM_SELECTORS = [".job-posting-title", ".ResAtsJobPosting__title"] as const;
export const JOBVITE_DOM_SELECTORS = [".jv-job-detail", ".jv-header-title"] as const;
export const RECRUITEE_DOM_SELECTORS = [".custom-css-style-job-title", ".offer-header h1"] as const;

export interface BoardDetection {
  board: KnownJobBoard;
  matchUrl: (url: URL) => boolean;
  domSelectors: readonly string[];
}

export function hostnameMatches(hostname: string, allowed: readonly string[]): boolean {
  const host = hostname.toLowerCase();
  return allowed.some((candidate) => host === candidate || host.endsWith(`.${candidate}`));
}

export function isWorkdayHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === WORKDAY_HOST_SUFFIX || host.endsWith(`.${WORKDAY_HOST_SUFFIX}`);
}

export function isBrandedHost(
  hostname: string,
  suffix: string,
  excludedLabels: readonly string[] = MARKETING_HOST_LABELS,
): boolean {
  const host = hostname.toLowerCase();
  const dotted = `.${suffix}`;
  if (host === suffix || !host.endsWith(dotted)) {
    return false;
  }
  const label = host.slice(0, -dotted.length).split(".")[0] ?? "";
  return label.length > 0 && !excludedLabels.includes(label);
}

export function isBambooHrJobUrl(url: URL): boolean {
  if (!isBrandedHost(url.hostname, BAMBOOHR_HOST_SUFFIX)) {
    return false;
  }
  const path = url.pathname.toLowerCase();
  return path.includes(BAMBOOHR_CAREERS_PATH) || path.includes(BAMBOOHR_JOBS_PATH);
}

export const BOARD_DETECTION: readonly BoardDetection[] = [
  {
    board: "greenhouse",
    matchUrl: (url) => hostnameMatches(url.hostname, GREENHOUSE_HOSTS),
    domSelectors: GREENHOUSE_DOM_SELECTORS,
  },
  {
    board: "lever",
    matchUrl: (url) => hostnameMatches(url.hostname, LEVER_HOSTS),
    domSelectors: LEVER_DOM_SELECTORS,
  },
  {
    board: "ashby",
    matchUrl: (url) => hostnameMatches(url.hostname, ASHBY_HOSTS),
    domSelectors: ASHBY_DOM_SELECTORS,
  },
  {
    board: "workday",
    matchUrl: (url) => isWorkdayHost(url.hostname),
    domSelectors: WORKDAY_DOM_SELECTORS,
  },
  {
    board: "linkedin",
    matchUrl: (url) =>
      hostnameMatches(url.hostname, LINKEDIN_HOSTS) &&
      url.pathname.toLowerCase().includes(LINKEDIN_JOB_PATH),
    domSelectors: LINKEDIN_DOM_SELECTORS,
  },
  {
    board: "smartrecruiters",
    matchUrl: (url) => hostnameMatches(url.hostname, SMARTRECRUITERS_HOSTS),
    domSelectors: SMARTRECRUITERS_DOM_SELECTORS,
  },
  {
    board: "icims",
    matchUrl: (url) => isBrandedHost(url.hostname, ICIMS_HOST_SUFFIX),
    domSelectors: ICIMS_DOM_SELECTORS,
  },
  {
    board: "workable",
    matchUrl: (url) =>
      hostnameMatches(url.hostname, WORKABLE_HOSTS) ||
      isBrandedHost(url.hostname, WORKABLE_HOST_SUFFIX),
    domSelectors: WORKABLE_DOM_SELECTORS,
  },
  {
    board: "bamboohr",
    matchUrl: isBambooHrJobUrl,
    domSelectors: BAMBOOHR_DOM_SELECTORS,
  },
  {
    board: "jobvite",
    matchUrl: (url) =>
      hostnameMatches(url.hostname, JOBVITE_HOSTS) ||
      isBrandedHost(url.hostname, JOBVITE_HOST_SUFFIX),
    domSelectors: JOBVITE_DOM_SELECTORS,
  },
  {
    board: "recruitee",
    matchUrl: (url) => isBrandedHost(url.hostname, RECRUITEE_HOST_SUFFIX),
    domSelectors: RECRUITEE_DOM_SELECTORS,
  },
];

export function detectJobBoard(pageUrl: string, root?: PageRoot): JobBoard {
  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    return "unknown";
  }

  for (const entry of BOARD_DETECTION) {
    if (entry.matchUrl(url)) {
      return entry.board;
    }
  }
  if (root) {
    for (const entry of BOARD_DETECTION) {
      if (firstMatching(root, entry.domSelectors)) {
        return entry.board;
      }
    }
  }
  return "unknown";
}

export function firstPathSegment(pathname: string): string {
  return pathname.split("/").filter(Boolean)[0] ?? "";
}

export function companyFromHostPrefix(hostname: string, suffix: string): string {
  const host = hostname.toLowerCase();
  const dotted = `.${suffix}`;
  if (!host.endsWith(dotted)) {
    return "";
  }
  return host.slice(0, -dotted.length).split(".")[0] ?? "";
}

export function workdayCompanyFromHost(hostname: string): string {
  return companyFromHostPrefix(hostname, WORKDAY_HOST_SUFFIX);
}

export function icimsCompanyFromHost(hostname: string): string {
  const raw = companyFromHostPrefix(hostname, ICIMS_HOST_SUFFIX);
  return raw.replace(/^(careers|jobs)-/, "").replace(/-(careers|jobs)$/, "");
}

export function workableCompanyFromUrl(url: URL): string {
  if (hostnameMatches(url.hostname, WORKABLE_HOSTS)) {
    return firstPathSegment(url.pathname);
  }
  return companyFromHostPrefix(url.hostname, WORKABLE_HOST_SUFFIX);
}

export function jobviteCompanyFromUrl(url: URL): string {
  if (hostnameMatches(url.hostname, JOBVITE_HOSTS)) {
    return firstPathSegment(url.pathname);
  }
  return companyFromHostPrefix(url.hostname, JOBVITE_HOST_SUFFIX);
}
