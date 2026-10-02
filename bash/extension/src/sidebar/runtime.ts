export function sendMessage<T>(message: unknown): Promise<T> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ error: chrome.runtime.lastError.message } as T);
          return;
        }
        resolve((response ?? {}) as T);
      });
    } catch (err) {
      resolve({
        error: err instanceof Error ? err.message : String(err),
      } as T);
    }
  });
}
