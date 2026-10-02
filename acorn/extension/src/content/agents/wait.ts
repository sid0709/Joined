/** Quiet window: no childList mutations. */
export const DOM_QUIET_WINDOW_MS = 700;
/** Form values must stay unchanged this long before parse is treated as done. */
export const FORM_STABLE_MS = 1500;
/** If values never change, wait at least this long after attach (slow parse). */
export const FORM_IDLE_BEFORE_FILL_MS = 8000;
/** Cap so a chatty page cannot block fills forever. */
export const FORM_STABLE_MAX_MS = 20_000;
/** Cap for aria-busy / progress. */
export const DOM_QUIET_MAX_MS = 10_000;

export async function waitMs(ms: number | null): Promise<number> {
  const delay = typeof ms === "number" && Number.isFinite(ms) ? Math.max(0, ms) : 500;
  await new Promise((resolve) => setTimeout(resolve, delay));
  return delay;
}

function isUploadBusy(doc: Document): boolean {
  if (doc.querySelector('[aria-busy="true"]')) return true;
  if (doc.querySelector('[role="progressbar"]')) return true;
  return false;
}

/**
 * Length/state only — never values, names, or PII.
 * Skips hidden/submit controls that often tick in the background.
 */
function formValueFingerprint(doc: Document): string {
  const fields = doc.querySelectorAll(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea',
  );
  const parts: string[] = [`n:${fields.length}`];
  for (const node of Array.from(doc.querySelectorAll("input, select, textarea"))) {
    if (!(node instanceof HTMLElement)) continue;
    if (node instanceof HTMLInputElement) {
      const type = (node.type || "text").toLowerCase();
      if (type === "hidden" || type === "submit" || type === "button" || type === "image") {
        continue;
      }
      if (type === "password") {
        parts.push(`p:${node.value.length}`);
        continue;
      }
      if (type === "file") {
        parts.push(`f:${node.files?.length ?? 0}`);
        continue;
      }
      if (type === "checkbox" || type === "radio") {
        parts.push(`${type[0]}:${node.checked ? 1 : 0}`);
        continue;
      }
      parts.push(`i:${type}:${node.value.length}`);
      continue;
    }
    if (node instanceof HTMLSelectElement) {
      parts.push(`s:${node.selectedIndex}:${node.value.length}`);
      continue;
    }
    if (node instanceof HTMLTextAreaElement) {
      parts.push(`t:${node.value.length}`);
    }
  }
  for (const node of Array.from(doc.querySelectorAll('[role="combobox"]'))) {
    if (!(node instanceof HTMLElement)) continue;
    const text = (node.innerText || node.textContent || "").replace(/\s+/g, " ").trim();
    parts.push(`c:${text.length}`);
  }
  return parts.join("|");
}

/**
 * Wait until the document stops adding/removing nodes (resume parse, autofill
 * remount, field reset) or until maxMs. Returns elapsed milliseconds.
 */
export async function waitForDomQuiet(
  doc: Document = document,
  quietMs = DOM_QUIET_WINDOW_MS,
  maxMs = DOM_QUIET_MAX_MS,
): Promise<number> {
  const root = doc.body || doc.documentElement;
  if (!root) return 0;
  const started = Date.now();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(quietTimer);
      clearTimeout(maxTimer);
      resolve(Date.now() - started);
    };
    let quietTimer = setTimeout(finish, quietMs);
    const bump = () => {
      clearTimeout(quietTimer);
      quietTimer = setTimeout(finish, quietMs);
    };
    const observer = new MutationObserver(bump);
    observer.observe(root, { subtree: true, childList: true });
    const maxTimer = setTimeout(finish, maxMs);
  });
}

export type UploadSettleReason = "stable-after-change" | "idle-no-change" | "max";

/**
 * After a file is attached, wait until resume parse / autofill has finished
 * resetting the form (values stop changing), not merely until the file input
 * accepted the File object.
 */
export async function waitForUploadComplete(doc: Document = document): Promise<{
  busyMs: number;
  sawBusy: boolean;
  changeCount: number;
  elapsedMs: number;
  reason: UploadSettleReason;
  passwordEmpty: number;
  passwordCount: number;
  quietMs: number;
}> {
  const busyStarted = Date.now();
  let sawBusy = isUploadBusy(doc);
  const busyDeadline = Date.now() + DOM_QUIET_MAX_MS;
  while (isUploadBusy(doc) && Date.now() < busyDeadline) {
    sawBusy = true;
    await waitMs(150);
  }
  const busyMs = Date.now() - busyStarted;

  const started = Date.now();
  let last = formValueFingerprint(doc);
  let lastChange = started;
  let changeCount = 0;
  let reason: UploadSettleReason = "max";

  while (Date.now() - started < FORM_STABLE_MAX_MS) {
    await waitMs(200);
    const next = formValueFingerprint(doc);
    if (next !== last) {
      last = next;
      lastChange = Date.now();
      changeCount += 1;
      continue;
    }
    const stableFor = Date.now() - lastChange;
    if (changeCount > 0 && stableFor >= FORM_STABLE_MS) {
      reason = "stable-after-change";
      break;
    }
    if (
      changeCount === 0 &&
      Date.now() - started >= FORM_IDLE_BEFORE_FILL_MS &&
      stableFor >= FORM_STABLE_MS
    ) {
      reason = "idle-no-change";
      break;
    }
  }

  const quietMs = await waitForDomQuiet(doc);
  const passwords = Array.from(doc.querySelectorAll('input[type="password"]')).filter(
    (node): node is HTMLInputElement => node instanceof HTMLInputElement,
  );

  return {
    busyMs,
    sawBusy,
    changeCount,
    elapsedMs: Date.now() - started,
    reason,
    passwordEmpty: passwords.filter((el) => !el.value).length,
    passwordCount: passwords.length,
    quietMs,
  };
}
