import { patchCustomTab, getCustomTab } from "../tab-custom-session";
import { extractRememberedTabJd } from "./custom-page-jd";
import { runResumeGenerate } from "./run-generate";

export async function runCustomGenerate(args: {
  tabId: number;
  apiUrl: string;
  continue?: boolean;
}): Promise<void> {
  const { tabId, apiUrl } = args;
  await runResumeGenerate({
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
    },
  });
}
