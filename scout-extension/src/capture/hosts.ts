import type { JobBoard } from "./types";

export const GREENHOUSE_HOSTS = ["boards.greenhouse.io", "job-boards.greenhouse.io"] as const;
export const LEVER_HOSTS = ["jobs.lever.co"] as const;
export const ASHBY_HOSTS = ["jobs.ashbyhq.com"] as const;
export const WORKDAY_HOST_SUFFIX = "myworkdayjobs.com";
export const LINKEDIN_HOSTS = ["linkedin.com"] as const;
export const LINKEDIN_JOB_PATH = "/jobs/";

export function hostnameMatches(hostname: string, allowed: readonly string[]): boolean {
  const host = hostname.toLowerCase();
  return allowed.some((candidate) => host === candidate || host.endsWith(`.${candidate}`));
}

export function isWorkdayHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === WORKDAY_HOST_SUFFIX || host.endsWith(`.${WORKDAY_HOST_SUFFIX}`);
}

export function detectJobBoard(pageUrl: string): JobBoard {
  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    return "unknown";
  }

  const host = url.hostname;
  if (hostnameMatches(host, GREENHOUSE_HOSTS)) {
    return "greenhouse";
  }
  if (hostnameMatches(host, LEVER_HOSTS)) {
    return "lever";
  }
  if (hostnameMatches(host, ASHBY_HOSTS)) {
    return "ashby";
  }
  if (isWorkdayHost(host)) {
    return "workday";
  }
  if (
    hostnameMatches(host, LINKEDIN_HOSTS) &&
    url.pathname.toLowerCase().includes(LINKEDIN_JOB_PATH)
  ) {
    return "linkedin";
  }
  return "unknown";
}

export function firstPathSegment(pathname: string): string {
  return pathname.split("/").filter(Boolean)[0] ?? "";
}

export function workdayCompanyFromHost(hostname: string): string {
  const host = hostname.toLowerCase();
  const suffix = `.${WORKDAY_HOST_SUFFIX}`;
  if (!host.endsWith(suffix)) {
    return "";
  }
  return host.slice(0, -suffix.length).split(".")[0] ?? "";
}
