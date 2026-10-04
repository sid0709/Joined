import { getCustomTab, patchCustomTab } from "../tab-custom-session";
import { getJobGenerate, patchJobGenerate } from "../tab-job-generate-session";

export async function patchCustomGenerateFailed(tabId: number, error: string): Promise<void> {
  const tab = await getCustomTab(tabId);
  if (tab?.generateStatus === "failed" && tab.checkpoint) {
    if (!tab.generateError) {
      await patchCustomTab(tabId, { generateError: error });
    }
    return;
  }
  await patchCustomTab(tabId, {
    generateStatus: "failed",
    generateError: error,
  });
}

export async function patchJobGenerateFailed(jobId: string, error: string): Promise<void> {
  const row = await getJobGenerate(jobId);
  if (row?.generateStatus === "failed" && row.checkpoint) {
    if (!row.generateError) {
      await patchJobGenerate(jobId, { generateError: error });
    }
    return;
  }
  await patchJobGenerate(jobId, {
    generateStatus: "failed",
    generateError: error,
  });
}
