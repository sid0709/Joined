/**
 * Detect which browsing context owns a fillable application form.
 * Vendor-agnostic: score live DOM controls — never hostname allowlists.
 */

import { waitMs } from "./agents/wait";

/** Minimum fillable controls for a child frame to participate in Acorn. */
export const MIN_CHILD_FORM_CONTROLS = 2;
/** How often to re-count controls while an SPA hydrates. */
export const FORM_SURFACE_POLL_MS = 200;
/** Cap waiting for fillable controls before serializing anyway. */
export const FORM_SURFACE_MAX_MS = 5000;

const FILLABLE_SELECTOR = [
  'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]):not([type="reset"])',
  "select",
  "textarea",
  '[contenteditable="true"]',
  '[role="textbox"]',
  '[role="combobox"]',
  '[role="searchbox"]',
  '[role="listbox"]',
].join(",");

/** Count fillable controls, including those inside open shadow roots. */
export function formControlScore(doc: ParentNode = document): number {
  const seen = new Set<ParentNode>();
  const visit = (node: ParentNode): number => {
    if (seen.has(node)) return 0;
    seen.add(node);
    let n = 0;
    try {
      n += node.querySelectorAll(FILLABLE_SELECTOR).length;
      for (const el of Array.from(node.querySelectorAll("*"))) {
        if (el.shadowRoot) n += visit(el.shadowRoot);
      }
    } catch {
      /* closed tree */
    }
    return n;
  };
  return visit(doc);
}

/** Wait until this frame has at least `minScore` fillable controls, or `maxMs`. */
export async function waitForFormSurface(
  minScore = 1,
  maxMs = FORM_SURFACE_MAX_MS,
): Promise<number> {
  const started = Date.now();
  let score = formControlScore();
  while (score < minScore && Date.now() - started < maxMs) {
    await waitMs(FORM_SURFACE_POLL_MS);
    score = formControlScore();
  }
  return score;
}

/**
 * Frames that may serialize DOM / run plan steps.
 * Top frame always can; child frames only when they look like a form surface.
 */
export function isAcornDomFrame(): boolean {
  if (window === window.top) return true;
  return formControlScore() >= MIN_CHILD_FORM_CONTROLS;
}
