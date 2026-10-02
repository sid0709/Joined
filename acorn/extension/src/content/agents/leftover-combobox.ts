import { fillElement } from "./fill";
import { readControlValue } from "./read-control-value";

/** Planner-less leftover controls: matcher AI answers from the applicant profile. */
const PROFILE_ANSWER = "Answer from the applicant profile";
const MAX_LEFTOVER = 8;

function isDisplayed(el: HTMLElement): boolean {
  if (el.getClientRects().length === 0) return false;
  const style = el.ownerDocument.defaultView?.getComputedStyle(el);
  if (!style) return true;
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

function isCombobox(el: HTMLElement): boolean {
  const role = (el.getAttribute("role") || "").toLowerCase();
  return (
    role === "combobox" ||
    el instanceof HTMLSelectElement ||
    el.getAttribute("aria-haspopup") === "listbox"
  );
}

function fieldLabel(el: HTMLElement): string {
  const labelled = el.getAttribute("aria-labelledby");
  if (labelled) {
    const parts = labelled
      .split(/\s+/)
      .map((id) => el.ownerDocument.getElementById(id)?.textContent?.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (parts.length) return parts.join(" ");
  }
  const aria = el.getAttribute("aria-label")?.replace(/\s+/g, " ").trim();
  if (aria) return aria;
  if (el.id) {
    const forLabel = el.ownerDocument
      .querySelector(`label[for="${CSS.escape(el.id)}"]`)
      ?.textContent?.replace(/\s+/g, " ")
      .trim();
    if (forLabel) return forLabel;
  }
  const wrap = el.closest("label")?.textContent?.replace(/\s+/g, " ").trim();
  if (wrap) return wrap.slice(0, 200);
  return "";
}

export async function fillLeftoverComboboxes(): Promise<{
  found: number;
  filled: number;
  raceLike: number;
}> {
  const nodes = Array.from(
    document.querySelectorAll('[role="combobox"], select, [aria-haspopup="listbox"]'),
  ).filter((node): node is HTMLElement => node instanceof HTMLElement);

  const leftovers = nodes
    .filter((el) => {
      if (!isCombobox(el) || !isDisplayed(el)) return false;
      if (el instanceof HTMLInputElement && (el.disabled || el.readOnly)) return false;
      if (el instanceof HTMLSelectElement && el.disabled) return false;
      if (el.getAttribute("aria-disabled") === "true") return false;
      return !readControlValue(el);
    })
    .slice(0, MAX_LEFTOVER);

  let filled = 0;
  let raceLike = 0;
  for (const el of leftovers) {
    const label = fieldLabel(el);
    if (/identify your race|\brace\b/i.test(label)) raceLike += 1;
    // School typeaheads need the planned value typed as a search query.
    // Leftover "Answer from the applicant profile" overwrites a filled School.
    if (/\b(school|university|college)\b/i.test(label)) continue;
    try {
      await fillElement(el, PROFILE_ANSWER, label || null);
      if (readControlValue(el)) filled += 1;
    } catch {
      /* continue remaining leftovers */
    }
  }

  return { found: leftovers.length, filled, raceLike };
}
