import { getCustomTab, patchCustomTab } from "../tab-custom-session";
import { extractRememberedTabJd } from "./custom-page-jd";
import { runResumeRecommend } from "./run-recommend";

export async function runCustomRecommend(args: {
  tabId: number;
  apiUrl: string;
  continue?: boolean;
}): Promise<void> {
  const { tabId, apiUrl } = args;
  await runResumeRecommend({
    source: "custom",
    apiUrl,
    continue: Boolean(args.continue),
    loadJd: () => extractRememberedTabJd(tabId, apiUrl),
    store: {
      patch: async (partial) => {
        await patchCustomTab(tabId, partial);
      },
      readCheckpoint: async () => {
        const tab = await getCustomTab(tabId);
        return tab?.checkpoint ?? null;
      },
      readStatus: async () => {
        const tab = await getCustomTab(tabId);
        return tab?.generateStatus ?? null;
      },
      complete: async (result) => {
        await patchCustomTab(tabId, {
          recommendedResumeId: result.recommendedResumeId,
          recommendedResumeStack: result.recommendedResumeStack,
          recommendedResumeReason: result.recommendedResumeReason,
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
