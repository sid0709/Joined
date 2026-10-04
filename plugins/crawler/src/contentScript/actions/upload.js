/* global chrome */
import { clickLikeHuman, wait } from "./dom";

function base64ToUint8Array(base64) {
  const value = base64 == null ? "" : String(base64);
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function inferFilename(filePath) {
  const raw = filePath == null ? "" : String(filePath);
  const normalized = raw.replace(/\//g, "\\");
  const parts = normalized.split("\\").filter(Boolean);
  return parts[parts.length - 1] || "upload.bin";
}

function inferMimeType(fileName) {
  const lower = String(fileName || "").toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".rtf")) return "application/rtf";
  return "application/octet-stream";
}

function normalizeUploadField(field) {
  const raw = String(field || "")
    .toLowerCase()
    .trim();
  if (!raw) return "";
  if (raw === "coverletter") return "cover";
  return raw;
}

function scoreFileInput(input, options = {}) {
  if (!(input instanceof HTMLInputElement) || String(input.type || "").toLowerCase() !== "file")
    return -1;
  if (input.disabled) return -1;

  const field = normalizeUploadField(options.field);
  const scopeParent = options.scopeParent || null;
  const beforeSet = options.beforeSet || null;

  let score = 0;

  if (beforeSet && !beforeSet.has(input)) score += 2; // newly appeared after click

  const id = String(input.id || "").toLowerCase();
  const name = String(input.name || "").toLowerCase();
  const aria = String(input.getAttribute("aria-label") || "").toLowerCase();
  const accept = String(input.getAttribute("accept") || "").toLowerCase();
  const combined = `${id} ${name} ${aria}`;

  if (field) {
    if (combined.includes(field)) score += 4;
    if (field === "resume" && combined.includes("cv")) score += 1;
    if (
      field === "cover" &&
      (combined.includes("cover_letter") || combined.includes("cover letter"))
    )
      score += 2;
  }

  // Prefer inputs in an active dialog/modal if one exists.
  const dialog = input.closest?.(
    '[role="dialog"], [aria-modal="true"], .modal, .MuiDialog-root, .ReactModal__Content',
  );
  if (dialog && dialog.offsetParent !== null) score += 2;

  // Prefer within current scoped parent.
  if (scopeParent && scopeParent.contains?.(input)) score += 2;

  if (accept.includes("pdf")) score += 1;

  return score;
}

async function waitForBestFileInput(options = {}) {
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 2500;
  const start = Date.now();

  const pickBestNow = () => {
    const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
    let best = null;
    let bestScore = -1;
    for (const input of inputs) {
      const score = scoreFileInput(input, options);
      if (score > bestScore) {
        bestScore = score;
        best = input;
      }
    }
    return best;
  };

  if (timeoutMs <= 0) {
    return pickBestNow();
  }

  while (Date.now() - start < timeoutMs) {
    const best = pickBestNow();

    if (best && scoreFileInput(best, options) >= 2) return best;
    await wait(50);
  }

  // Last chance: return any file input even if low confidence.
  const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
  return inputs[0] || null;
}

async function requestLocalFileFromBackend(filePath) {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
      resolve({ success: false, error: "chrome.runtime.sendMessage not available" });
      return;
    }

    try {
      chrome.runtime.sendMessage(
        { action: "readLocalFile", payload: { path: filePath } },
        (response) => {
          if (!response?.success) {
            resolve({ success: false, error: response?.error || "readLocalFile failed" });
            return;
          }
          resolve({ success: true, data: response.data || null });
        },
      );
    } catch (e) {
      resolve({ success: false, error: String((e && e.message) || e) });
    }
  });
}

async function setFileOnInput(fileInput, filePath) {
  if (
    !(fileInput instanceof HTMLInputElement) ||
    String(fileInput.type || "").toLowerCase() !== "file"
  ) {
    return { success: false, error: 'Target is not an <input type="file">' };
  }
  if (!filePath) return { success: false, error: "No file path provided" };

  const result = await requestLocalFileFromBackend(filePath);
  if (!result.success) return result;

  const payload = result.data || {};
  const fileName = payload.fileName || inferFilename(filePath);
  const mimeType = payload.mimeType || inferMimeType(fileName);
  const bytes = base64ToUint8Array(payload.base64 || "");
  const file = new File([bytes], fileName, { type: mimeType });

  const dt = new DataTransfer();
  dt.items.add(file);

  try {
    fileInput.focus?.();
  } catch {
    /* best effort */
  }

  fileInput.files = dt.files;

  fileInput.dispatchEvent(new Event("input", { bubbles: true }));
  fileInput.dispatchEvent(new Event("change", { bubbles: true }));

  return { success: true };
}

export async function performUpload(payload, targetElement, scopeParent) {
  const filePath = payload?.value;
  const field = payload?.field || "";

  if (!filePath) return { success: false, error: "No file path provided" };

  // If we already have the actual input, just set it.
  if (
    targetElement instanceof HTMLInputElement &&
    String(targetElement.type || "").toLowerCase() === "file"
  ) {
    return await setFileOnInput(targetElement, filePath);
  }

  // Prefer existing file inputs (avoids triggering the native file picker modal).
  const existing = await waitForBestFileInput({ field, scopeParent, timeoutMs: 0 });
  if (existing) {
    const directScore = scoreFileInput(existing, { field, scopeParent });
    if (directScore >= 2) {
      return await setFileOnInput(existing, filePath);
    }
  }

  // Otherwise: click to reveal/activate the underlying <input type="file">, then find the best candidate and set it.
  const before = new Set(Array.from(document.querySelectorAll('input[type="file"]')));
  if (targetElement) clickLikeHuman(targetElement);

  const best = await waitForBestFileInput({
    beforeSet: before,
    field,
    scopeParent,
    timeoutMs: 3500,
  });
  if (!best)
    return { success: false, error: 'No <input type="file"> found after opening upload UI' };

  return await setFileOnInput(best, filePath);
}
