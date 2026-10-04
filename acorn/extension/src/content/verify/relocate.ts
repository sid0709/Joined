import type { VerifyResult } from "../verify-element";
import { associatedControl, labelCandidates, normalize } from "./element-labels";
import { inferRole, roleMatches } from "./element-role";
import { labelMatches } from "./label-match";

function isDisplayed(el: HTMLElement): boolean {
  if (el.getClientRects().length === 0) return false;
  const style = el.ownerDocument?.defaultView?.getComputedStyle(el);
  if (!style) return Boolean(el.offsetParent);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

const RELOCATE_SELECTOR = [
  'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"])',
  "select",
  "textarea",
  '[role="combobox"]',
  '[role="option"]',
  '[role="textbox"]',
].join(",");

const CONFIRM_SECRET_RE = /\b(re-?enter|confirm|again|repeat)\b/i;

function looksLikeConfirmSecret(text: string): boolean {
  return CONFIRM_SECRET_RE.test(text);
}

function pickRelocateMatch(
  pool: HTMLElement[],
  expectedLabel: string | null,
  expectedRole: string | null,
  intendedValue: string | null | undefined,
): HTMLElement[] {
  let next = pool;
  if (intendedValue?.trim() && next.length > 1) {
    const want = normalize(intendedValue);
    const byValue = next.filter((el) => {
      const text = normalize(
        el.getAttribute("aria-label") ||
          el.innerText ||
          (el instanceof HTMLInputElement ? el.value : "") ||
          "",
      );
      return Boolean(text) && (text === want || text.includes(want) || want.includes(text));
    });
    if (byValue.length) next = byValue;
  }

  if (expectedLabel && next.length > 1) {
    const exp = normalize(expectedLabel);
    const exact = next.filter((el) => labelCandidates(el).some((c) => normalize(c) === exp));
    if (exact.length) next = exact;
  }

  if (expectedLabel && next.length > 1) {
    const wantConfirm = looksLikeConfirmSecret(expectedLabel);
    const split = next.filter((el) =>
      wantConfirm
        ? looksLikeConfirmSecret(labelCandidates(el).join(" "))
        : !looksLikeConfirmSecret(labelCandidates(el).join(" ")),
    );
    if (split.length) next = split;
  }

  const expRole = normalize(expectedRole || "");
  if (next.length > 1 && (expRole === "password" || expRole === "textbox")) {
    const passwords = next.filter((el) => el instanceof HTMLInputElement && el.type === "password");
    if (passwords.length === 1) return passwords;
    if (passwords.length) next = passwords;
    const typed = next.filter(
      (el) => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement,
    );
    if (typed.length === 1) return typed;
    if (typed.length) next = typed;
  }

  return next;
}

/**
 * After upload/parse remounts the form, acorn-ids go stale. Re-find the control
 * by planned label + role (and option value when the plan targeted an option).
 */
export function relocateElementByPlan(
  expectedLabel: string | null,
  expectedRole: string | null,
  intendedValue?: string | null,
): VerifyResult {
  if (!String(expectedLabel || "").trim() && !String(expectedRole || "").trim()) {
    return {
      ok: false,
      element: null,
      error: "Cannot relocate without expected_label or expected_role",
    };
  }

  const seen = new Set<Element>();
  const matches: HTMLElement[] = [];
  for (const node of Array.from(document.querySelectorAll(RELOCATE_SELECTOR))) {
    if (!(node instanceof HTMLElement)) continue;
    const el = (associatedControl(node) ?? node) as HTMLElement;
    if (seen.has(el)) continue;
    seen.add(el);
    const role = inferRole(el);
    if (expectedRole && !roleMatches(expectedRole, role, el)) continue;
    if (expectedLabel && !labelMatches(expectedLabel, labelCandidates(el))) continue;
    matches.push(el);
  }

  const displayed = matches.filter(isDisplayed);
  const picked = pickRelocateMatch(
    displayed.length ? displayed : matches,
    expectedLabel,
    expectedRole,
    intendedValue,
  );

  if (picked.length !== 1) {
    return {
      ok: false,
      element: picked[0] || null,
      matchedLabel: picked[0] ? labelCandidates(picked[0])[0] : undefined,
      matchedRole: picked[0] ? inferRole(picked[0]) : undefined,
      error: `Relocate found ${picked.length} matches`,
    };
  }

  const el = picked[0];
  return {
    ok: true,
    element: el,
    matchedLabel: labelCandidates(el)[0] || "",
    matchedRole: inferRole(el),
  };
}
