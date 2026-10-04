import { normalizeBaseUrl, readStorageValue } from "../runtime.js";

// Content script -> background: read a local file via core-backend and return base64.
export function handleReadLocalFile(message, sendResponse) {
  (async () => {
    try {
      const baseUrl = normalizeBaseUrl(await readStorageValue("spiritApiBaseUrl"));
      if (!baseUrl) {
        sendResponse?.({ success: false, error: "spiritApiBaseUrl not set" });
        return;
      }

      const filePath = message?.payload?.path;
      if (!filePath || typeof filePath !== "string") {
        sendResponse?.({ success: false, error: "Missing payload.path" });
        return;
      }

      const resp = await fetch(`${baseUrl}/local-file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath }),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        sendResponse?.({
          success: false,
          error: `local-file failed (${resp.status}): ${text || resp.statusText}`,
        });
        return;
      }
      const data = await resp.json();
      sendResponse?.({ success: true, data });
    } catch (e) {
      sendResponse?.({ success: false, error: String((e && e.message) || e) });
    }
  })();
}
