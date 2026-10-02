import { getJobGenerate, patchJobGenerate } from "../tab-job-generate-session";
import { loadFillJobJd } from "./job-generate";
import { runResumeRecommend } from "./run-recommend";

export async function runJobRecommend(args: {
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
  await runResumeRecommend({
    source: "fill",
    apiUrl,
    continue: Boolean(args.continue),
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
      complete: async (result) => {
        await patchJobGenerate(jobId, {
          recommendedResumeId: result.recommendedResumeId,
          recommendedResumeStack: result.recommendedResumeStack,
          generateStatus: "completed",
          generateError: null,
          generateProgress: null,
          checkpoint: result.checkpoint,
          jobDescription: result.jobDescription,
        });
      },
    },
  });
}
