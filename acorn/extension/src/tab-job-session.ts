export type AcornTabJobBinding = {
  jobId: string;
  resumeId: string | null;
  resumeStack: string | null;
  applyUrl: string;
  title: string;
  company: string;
};

export type JobAttachment = {
  tabId: number;
  active: boolean;
};

export const TAB_JOBS_STORAGE_KEY = "acornTabJobs";

export type TabJobMap = Record<string, AcornTabJobBinding>;

async function readMap(): Promise<TabJobMap> {
  const stored = await chrome.storage.session.get(TAB_JOBS_STORAGE_KEY);
  const raw = stored[TAB_JOBS_STORAGE_KEY];
  return raw && typeof raw === "object" ? (raw as TabJobMap) : {};
}

export async function listTabJobs(): Promise<TabJobMap> {
  return readMap();
}

const JOB_TOMBSTONE_MS = 2_000;
const jobTombstones = new Map<number, AcornTabJobBinding>();
const jobTombstoneTimers = new Map<number, ReturnType<typeof setTimeout>>();

function rememberJobTombstone(tabId: number, job: AcornTabJobBinding): void {
  jobTombstones.set(tabId, job);
  const prev = jobTombstoneTimers.get(tabId);
  if (prev) clearTimeout(prev);
  jobTombstoneTimers.set(
    tabId,
    setTimeout(() => {
      jobTombstones.delete(tabId);
      jobTombstoneTimers.delete(tabId);
    }, JOB_TOMBSTONE_MS),
  );
}

function takeJobTombstone(tabId: number): AcornTabJobBinding | null {
  const job = jobTombstones.get(tabId) ?? null;
  jobTombstones.delete(tabId);
  const timer = jobTombstoneTimers.get(tabId);
  if (timer) {
    clearTimeout(timer);
    jobTombstoneTimers.delete(tabId);
  }
  return job;
}

export async function bindTabJob(tabId: number, job: AcornTabJobBinding): Promise<void> {
  const map = await readMap();
  const key = String(tabId);
  for (const [tabKey, row] of Object.entries(map)) {
    if (row.jobId === job.jobId && tabKey !== key) delete map[tabKey];
  }
  map[key] = job;
  takeJobTombstone(tabId);
  await chrome.storage.session.set({ [TAB_JOBS_STORAGE_KEY]: map });
}

export async function getTabJob(tabId: number): Promise<AcornTabJobBinding | null> {
  const map = await readMap();
  return map[String(tabId)] ?? null;
}

export async function findTabIdsForJob(jobId: string): Promise<number[]> {
  const map = await readMap();
  const ids: number[] = [];
  for (const [tabId, job] of Object.entries(map)) {
    if (job.jobId !== jobId) continue;
    const id = Number(tabId);
    if (Number.isFinite(id)) ids.push(id);
  }
  return ids;
}

export async function findTabIdForJob(jobId: string): Promise<number | null> {
  const ids = await findTabIdsForJob(jobId);
  return ids[ids.length - 1] ?? null;
}

export async function rekeyTabJob(fromTabId: number, toTabId: number): Promise<void> {
  if (fromTabId === toTabId) return;
  const map = await readMap();
  const fromKey = String(fromTabId);
  const toKey = String(toTabId);
  const row = map[fromKey] ?? takeJobTombstone(fromTabId);
  if (!row) return;
  delete map[fromKey];
  for (const [tabKey, existing] of Object.entries(map)) {
    if (existing.jobId === row.jobId && tabKey !== toKey) delete map[tabKey];
  }
  map[toKey] = row;
  takeJobTombstone(toTabId);
  await chrome.storage.session.set({ [TAB_JOBS_STORAGE_KEY]: map });
}

export async function unbindTabJob(tabId: number): Promise<void> {
  const map = await readMap();
  const key = String(tabId);
  const row = map[key];
  if (!row) return;
  rememberJobTombstone(tabId, row);
  delete map[key];
  await chrome.storage.session.set({ [TAB_JOBS_STORAGE_KEY]: map });
}

export async function unbindJobFromAllTabs(jobId: string): Promise<void> {
  const map = await readMap();
  let changed = false;
  for (const [tabId, job] of Object.entries(map)) {
    if (job.jobId !== jobId) continue;
    delete map[tabId];
    changed = true;
  }
  if (changed) {
    await chrome.storage.session.set({ [TAB_JOBS_STORAGE_KEY]: map });
  }
}
