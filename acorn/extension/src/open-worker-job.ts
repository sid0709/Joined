import { sameApplyPage } from "@acorn/shared/apply-site";
import { focusChromeTab } from "./focus-tab";
import {
  bindTabJob,
  findTabIdsForJob,
  getTabJob,
  unbindTabJob,
  type AcornTabJobBinding,
} from "./tab-job-session";

export type OpenWorkerJobResult = {
  tabId: number;
  reused: boolean;
};

const openingByJob = new Map<string, Promise<OpenWorkerJobResult>>();

async function windowIdForTab(tabId: number | null): Promise<number | undefined> {
  if (tabId == null) return undefined;
  try {
    const tab = await chrome.tabs.get(tabId);
    return tab.windowId;
  } catch {
    return undefined;
  }
}

async function adoptTab(
  tabId: number,
  job: AcornTabJobBinding,
): Promise<OpenWorkerJobResult | null> {
  const focused = await focusChromeTab(tabId);
  if (!focused) {
    await unbindTabJob(tabId);
    return null;
  }
  await bindTabJob(tabId, job);
  return { tabId, reused: true };
}

async function findOpenTabMatchingApplyUrl(
  applyUrl: string,
  preferTabId: number | null,
): Promise<number | null> {
  const tabs = await chrome.tabs.query({});
  let matched: number | null = null;
  for (const tab of tabs) {
    if (tab.id == null) continue;
    const href = String(tab.pendingUrl || tab.url || "");
    if (!sameApplyPage(href, applyUrl)) continue;
    if (tab.id === preferTabId) return tab.id;
    if (tab.active || matched == null) matched = tab.id;
  }
  return matched;
}

async function openWorkerJobNow(args: {
  job: AcornTabJobBinding;
  preferredTabId: number | null;
  attachedTabId?: number | null;
}): Promise<OpenWorkerJobResult> {
  const { job, preferredTabId, attachedTabId = null } = args;
  const tried = new Set<number>();

  const tryAdopt = async (tabId: number | null): Promise<OpenWorkerJobResult | null> => {
    if (tabId == null || tried.has(tabId)) return null;
    tried.add(tabId);
    return adoptTab(tabId, job);
  };

  if (preferredTabId != null) {
    const preferredJob = await getTabJob(preferredTabId);
    if (preferredJob?.jobId === job.jobId) {
      const reused = await tryAdopt(preferredTabId);
      if (reused) return reused;
    }
  }

  const reusedAttached = await tryAdopt(attachedTabId);
  if (reusedAttached) return reusedAttached;

  const boundIds = await findTabIdsForJob(job.jobId);
  for (let i = boundIds.length - 1; i >= 0; i -= 1) {
    const reused = await tryAdopt(boundIds[i] ?? null);
    if (reused) return reused;
  }

  const matchedUrlId = await findOpenTabMatchingApplyUrl(job.applyUrl, preferredTabId);
  const reusedByUrl = await tryAdopt(matchedUrlId);
  if (reusedByUrl) return reusedByUrl;

  const created = await chrome.tabs.create({
    url: job.applyUrl,
    active: true,
    windowId: await windowIdForTab(preferredTabId),
  });
  if (!created.id) {
    throw new Error("Failed to open a tab for this job");
  }

  await bindTabJob(created.id, job);
  return { tabId: created.id, reused: false };
}

/**
 * Focus the existing tab bound to this job (or already on its apply URL),
 * or open the apply URL in a new tab. Never navigates the currently focused tab
 * to a different URL.
 */
export async function openWorkerJobInTab(args: {
  job: AcornTabJobBinding;
  preferredTabId: number | null;
  attachedTabId?: number | null;
}): Promise<OpenWorkerJobResult> {
  const jobId = args.job.jobId;
  const pending = openingByJob.get(jobId);
  if (pending) return pending;
  let work!: Promise<OpenWorkerJobResult>;
  work = openWorkerJobNow(args).finally(() => {
    if (openingByJob.get(jobId) === work) openingByJob.delete(jobId);
  });
  openingByJob.set(jobId, work);
  return work;
}
