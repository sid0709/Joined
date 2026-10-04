import { getJobGenerate, patchJobGenerate } from "../tab-job-generate-session";
import { fetchStoredJobDescription, NO_STORED_JD } from "./api/job-files";
import { runResumeGenerate } from "./run-generate";

export async function loadFillJobJd(args: {
  jobId: string;
  storedJd?: string | null;
  apiUrl: string;
}): Promise<{ jobDescription: string; title?: string; url?: string }> {
  const stored = String(args.storedJd || "").trim();
  if (stored) return { jobDescription: stored };
  try {
    const jobDescription = await fetchStoredJobDescription(args.jobId, args.apiUrl);
    return { jobDescription };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(message || NO_STORED_JD);
  }
}

export async function runJobGenerate(args: {
  jobId: string;
  tabId?: number | null;
  apiUrl: string;
  continue?: boolean;
  storedJd?: string | null;
}): Promise<void> {
  const { jobId, apiUrl } = args;
  if (args.tabId != null) {
    await patchJobGenerate(jobId, { tabId: args.tabId });
  }
  await runResumeGenerate({
    source: "fill",
    apiUrl,
    continue: Boolean(args.continue),
    jobId,
    loadJd: () =>
      loadFillJobJd({
        jobId,
        storedJd: args.storedJd,
        apiUrl,
      }),
    store: {
      patch: async (partial) => {
        const { resumeMode: _resumeMode, ...rest } = partial;
        await patchJobGenerate(jobId, rest);
      },
      readCheckpoint: async () => {
        const row = await getJobGenerate(jobId);
        return row?.checkpoint ?? null;
      },
      readStatus: async () => {
        const row = await getJobGenerate(jobId);
        return row?.generateStatus ?? null;
      },
    },
  });
}
