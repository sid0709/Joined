function contentScriptFiles(): string[] {
  const files: string[] = [];
  for (const spec of chrome.runtime.getManifest().content_scripts ?? []) {
    for (const file of spec.js ?? []) {
      if (!files.includes(file)) files.push(file);
    }
  }
  return files;
}

export function canInjectIntoUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol === "chrome:" ||
      parsed.protocol === "chrome-extension:" ||
      parsed.protocol === "edge:" ||
      parsed.protocol === "devtools:" ||
      parsed.protocol === "view-source:"
    ) {
      return false;
    }
    if (parsed.hostname === "chrome.google.com" && parsed.pathname.startsWith("/webstore")) {
      return false;
    }
    if (parsed.hostname === "chromewebstore.google.com") return false;
    return true;
  } catch {
    return false;
  }
}

export async function injectContentScripts(tabId: number, frameId?: number): Promise<void> {
  const files = contentScriptFiles();
  if (files.length === 0) return;
  try {
    await chrome.scripting.executeScript({
      target:
        typeof frameId === "number" ? { tabId, frameIds: [frameId] } : { tabId, allFrames: true },
      files,
    });
  } catch {
    /* restricted URL, closed tab, or already tearing down */
  }
}

export async function injectIntoOpenTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map((tab) => {
      if (tab.id == null || !canInjectIntoUrl(tab.url)) return Promise.resolve();
      return injectContentScripts(tab.id);
    }),
  );
}

export function bindContentScriptInjection(): void {
  const onNavigate = (details: { tabId: number; frameId: number; url: string }) => {
    if (!canInjectIntoUrl(details.url)) return;
    void injectContentScripts(details.tabId, details.frameId);
  };
  chrome.webNavigation.onCommitted.addListener(onNavigate);
  chrome.webNavigation.onHistoryStateUpdated.addListener(onNavigate);
  chrome.runtime.onInstalled.addListener(() => {
    void injectIntoOpenTabs();
  });
}
