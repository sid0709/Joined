import { formatCount } from "@/lib/format";

export const MIGRATION_PATH = "/v1/migration";
/** How often the console asks for progress while a step runs. */
export const MIGRATION_POLL_MS = 2_000;
/** Most temp jobs one hand-picked analysis takes; matches the admin API. */
export const MAX_MIGRATION_SELECTION = 1_000;
/** The env var that turns on the migration's AI steps. */
export const MIGRATION_KEY_ENV = "DEEPSEEK_API_KEY";

export const MIGRATION_TASKS = {
  copyJobs: "jobs-copy",
  analyzeJobs: "jobs-analyze",
  copyCompanies: "companies-copy",
  researchCompanies: "companies-research",
} as const;

export type MigrationTask = (typeof MIGRATION_TASKS)[keyof typeof MIGRATION_TASKS];

export type MigrationRunStatus = "running" | "succeeded" | "failed" | "canceled";

export type MigrationFailure = { id: string; error: string };

/** The latest run of one step, as GET /v1/migration reports it. */
export type MigrationRun = {
  task: MigrationTask;
  status: MigrationRunStatus;
  model?: string;
  total: number;
  done: number;
  skipped: number;
  failed: number;
  startedAt: string;
  finishedAt?: string;
  summary?: string;
  error?: string;
  failures: MigrationFailure[];
};

export type MigrationCounts = {
  jobSource: string;
  jobDestination: string;
  sourceJobs: number;
  tempJobs: number;
  analyzedJobs: number;
  companySource: string;
  /** Where copied companies wait until research publishes them. */
  companyStaging: string;
  companyDestination: string;
  sourceCompanies: number;
  /** Staged, not researched yet. */
  waitingCompanies: number;
  /** Staged because research could not find them on the web. */
  notFoundCompanies: number;
  /** Published: the directory and Joined show them. */
  companies: number;
  researchedCompanies: number;
};

export type MigrationStatus = {
  counts: MigrationCounts | null;
  model: string;
  modelReady: boolean;
  runs: Partial<Record<MigrationTask, MigrationRun>>;
};

/** What an AI step works on. Every field is optional. */
export type MigrationStart = {
  tempJobIds?: string[];
  redo?: boolean;
};

export function migrationTaskPath(task: MigrationTask) {
  return `${MIGRATION_PATH}/${task}`;
}

export function migrationCancelPath(task: MigrationTask) {
  return `${migrationTaskPath(task)}/cancel`;
}

export function isRunning(run: MigrationRun | undefined) {
  return run?.status === "running";
}

/** Items the run is through, whatever happened to them. */
export function runFinished(run: MigrationRun) {
  return run.done + run.skipped + run.failed;
}

/** Remaining time at the pace so far: "4m left", or "" before there is a pace. */
export function runEta(run: MigrationRun, now = Date.now()) {
  const finished = runFinished(run);
  const elapsed = now - new Date(run.startedAt).getTime();
  if (!isRunning(run) || finished === 0 || run.total <= finished || !(elapsed > 0)) return "";
  const seconds = Math.ceil(((run.total - finished) * elapsed) / finished / 1_000);
  if (seconds < 60) return `${seconds}s left`;
  if (seconds < 3_600) return `${Math.ceil(seconds / 60)}m left`;
  return `${Math.floor(seconds / 3_600)}h ${Math.ceil((seconds % 3_600) / 60)}m left`;
}

/** "1,200 of 5,000 · 3 skipped · 2 failed". */
export function runTally(run: MigrationRun) {
  const parts = [`${formatCount(runFinished(run))} of ${formatCount(run.total)}`];
  if (run.skipped) parts.push(`${formatCount(run.skipped)} skipped`);
  if (run.failed) parts.push(`${formatCount(run.failed)} failed`);
  return parts.join(" · ");
}

/** How many are left to do, never below zero. */
export function remaining(total: number, done: number) {
  return Math.max(0, total - done);
}
