import { resolveElementByNodeId } from "./element-resolver";

export interface VerifyResult {
  ok: boolean;
  element: Element | null;
  matchedLabel?: string;
  matchedRole?: string;
  error?: string;
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function pushLabel(labels: string[], value: string | null | undefined): void {
  const text = value?.replace(/\s+/g, " ").trim();
  if (text) labels.push(text);
}

const FIELD_TITLE_TAGS = /^(LABEL|LEGEND|H1|H2|H3|H4|H5|H6|P|SPAN|STRONG|DIV|DT|DD)$/;
const FIELD_TITLE_SNIPPET_CHARS = 240;

function pushFieldTitle(labels: string[], raw: string | null | undefined): void {
  const text = raw?.replace(/\s+/g, " ").trim();
  if (!text) return;
  pushLabel(labels, text.slice(0, FIELD_TITLE_SNIPPET_CHARS));
}

/** Native labeled control when the planned node is a <label>, not the input. */
function associatedControl(el: Element): Element | null {
  if (!(el instanceof HTMLLabelElement)) return null;
  if (el.control) return el.control;
  return el.querySelector("input, select, textarea, button");
}

/** Field titles often live on siblings/ancestors, not on the control itself (e.g. file "Attach"). */
function ancestorFieldLabels(el: Element): string[] {
  const labels: string[] = [];
  let node: Element | null = el.parentElement;
  let depth = 0;

  while (node && depth < 7) {
    pushLabel(labels, node.getAttribute("aria-label"));

    for (const child of Array.from(node.children)) {
      if (child === el || child.contains(el)) continue;
      const tag = child.tagName.toUpperCase();
      if (!FIELD_TITLE_TAGS.test(tag)) continue;
      const html = child as HTMLElement;
      const hasNestedControl = Boolean(child.querySelector("input, select, textarea, button, a"));
      if (hasNestedControl && tag !== "LABEL" && tag !== "LEGEND") continue;
      pushFieldTitle(labels, html.innerText || html.textContent);
    }

    const prev = node.previousElementSibling;
    if (prev && FIELD_TITLE_TAGS.test(prev.tagName.toUpperCase())) {
      pushFieldTitle(labels, (prev as HTMLElement).innerText || prev.textContent);
    }

    node = node.parentElement;
    depth += 1;
  }

  return labels;
}

function labelCandidates(el: Element): string[] {
  const html = el as HTMLElement;
  const primary: string[] = [];
  const own: string[] = [];

  pushLabel(primary, html.getAttribute?.("aria-label"));

  const labelledBy = html.getAttribute?.("aria-labelledby");
  if (labelledBy) {
    for (const id of labelledBy.split(/\s+/)) {
      const ref = el.ownerDocument?.getElementById(id);
      pushLabel(primary, ref?.textContent);
    }
  }

  if (html.id) {
    const forLabel = el.ownerDocument?.querySelector(`label[for="${CSS.escape(html.id)}"]`);
    pushLabel(primary, forLabel?.textContent);
  }

  const wrappingLabel = html.closest?.("label");
  if (wrappingLabel) {
    pushLabel(primary, wrappingLabel.textContent);
  }

  pushLabel(primary, html.getAttribute?.("placeholder"));
  pushLabel(primary, html.getAttribute?.("name"));

  const fieldset = html.closest?.("fieldset");
  pushLabel(primary, fieldset?.querySelector?.("legend")?.textContent);

  const prev = html.previousElementSibling;
  if (prev && FIELD_TITLE_TAGS.test(prev.tagName.toUpperCase())) {
    pushFieldTitle(primary, (prev as HTMLElement).innerText || prev.textContent);
  }

  for (const label of ancestorFieldLabels(el)) {
    pushLabel(primary, label);
  }

  const ownText = (html.innerText || html.textContent || "").trim();
  if (ownText && ownText.length < 200) own.push(ownText);

  // Keep control chrome text ("Attach", "Select...") last so field titles win.
  return [...new Set([...primary, ...own].filter(Boolean))];
}

function inferRole(el: Element): string {
  const html = el as HTMLElement;
  const explicit = html.getAttribute?.("role");
  if (explicit) return explicit.toLowerCase();

  const tag = el.tagName.toLowerCase();
  if (tag === "textarea") return "textbox";
  if (tag === "select") return "combobox";
  if (tag === "button") return "button";
  if (tag === "a") return "link";

  if (tag === "input") {
    const type = ((el as HTMLInputElement).type || "text").toLowerCase();
    if (type === "file") return "file";
    if (type === "radio") return "radio";
    if (type === "checkbox") return "checkbox";
    if (type === "password") return "password";
    if (type === "submit" || type === "button" || type === "image") return "submit button";
    if (type === "hidden") return "hidden";
    if (type === "tel") return "tel";
    if (type === "email") return "email";
    if (type === "url") return "url";
    if (
      html.getAttribute("aria-haspopup") === "listbox" ||
      html.getAttribute("aria-autocomplete") === "list" ||
      (html.hasAttribute("aria-expanded") && html.hasAttribute("aria-controls"))
    ) {
      return "combobox";
    }
    return "textbox";
  }

  if (html.isContentEditable) return "textbox";
  if (html.getAttribute?.("aria-haspopup") === "listbox") return "combobox";
  return tag;
}

function roleMatches(expected: string, actual: string, el: Element): boolean {
  const exp = normalize(expected);
  const act = normalize(actual);
  if (!exp) return true;
  if (exp === act) return true;

  const aliases: Record<string, string[]> = {
    textbox: [
      "textbox",
      "text",
      "input",
      "searchbox",
      "email",
      "tel",
      "url",
      "spinbutton",
      "password",
    ],
    password: ["password", "textbox", "text", "input"],
    spinbutton: ["spinbutton", "textbox", "text", "input", "number"],
    // Search-style select inputs often look like a textbox to the planner.
    combobox: [
      "combobox",
      "select",
      "listbox",
      "dropdown",
      "textbox",
      "text",
      "input",
      "searchbox",
    ],
    file: ["file", "upload"],
    radio: ["radio", "radiogroup"],
    checkbox: ["checkbox"],
    button: ["button"],
    "submit button": ["submit button", "button", "submit"],
    textarea: ["textarea", "textbox", "text", "input"],
  };

  for (const [canonical, list] of Object.entries(aliases)) {
    if (list.includes(exp) && list.includes(act)) return true;
    if (exp.includes(canonical) && list.includes(act)) return true;
  }

  if (exp.includes("submit") && (act === "button" || act === "submit button")) {
    const type = (el as HTMLInputElement).type?.toLowerCase?.();
    const text = normalize((el as HTMLElement).innerText || el.textContent || "");
    if (type === "submit" || text.includes("submit")) return true;
  }

  return act.includes(exp) || exp.includes(act);
}

function labelTokens(text: string): string[] {
  return text
    .replace(/[?*]+$/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** True when every `want` token appears in `have` in order (extra live words allowed). */
function tokenSubsequence(want: string[], have: string[]): boolean {
  if (!want.length) return true;
  let i = 0;
  for (const tok of have) {
    if (tok === want[i]) i += 1;
    if (i === want.length) return true;
  }
  return false;
}

function labelMatches(expected: string, candidates: string[]): boolean {
  const exp = normalize(expected);
  if (!exp) return true;
  const expBare = exp.replace(/[?*]+$/g, "").trim();
  const want = labelTokens(expBare);
  return candidates.some((c) => {
    const n = normalize(c)
      .replace(/[?*]+$/g, "")
      .trim();
    if (n === exp || n === expBare || n.includes(expBare) || expBare.includes(n)) return true;
    // Plans often truncate long Greenhouse labels; require a long shared prefix.
    const prefixLen = Math.min(72, expBare.length, n.length);
    if (prefixLen >= 40 && n.slice(0, prefixLen) === expBare.slice(0, prefixLen)) {
      return true;
    }
    const have = labelTokens(n);
    const smaller = want.length <= have.length ? want : have;
    const larger = want.length <= have.length ? have : want;
    if (!tokenSubsequence(smaller, larger)) return false;
    if (smaller.length >= 4) return true;
    return smaller.length / Math.max(larger.length, 1) >= 0.75;
  });
}

export function verifyElementByPlan(
  elementIndex: number,
  expectedLabel: string | null,
  expectedRole: string | null,
): VerifyResult {
  const resolved = resolveElementByNodeId(elementIndex);
  if (!resolved) {
    return {
      ok: false,
      element: null,
      error: `Element not found for index ${elementIndex}`,
    };
  }

  const el = associatedControl(resolved) ?? resolved;
  const matchedRole = inferRole(el);
  const candidates = labelCandidates(el);
  const matchedLabel = candidates[0] || "";

  if (expectedRole && !roleMatches(expectedRole, matchedRole, el)) {
    return {
      ok: false,
      element: el,
      matchedLabel,
      matchedRole,
      error: `Role mismatch at ${elementIndex}: expected "${expectedRole}", got "${matchedRole}"`,
    };
  }

  if (expectedLabel && !labelMatches(expectedLabel, candidates)) {
    return {
      ok: false,
      element: el,
      matchedLabel,
      matchedRole,
      error: `Label mismatch at ${elementIndex}: expected "${expectedLabel}", got "${matchedLabel || "(none)"}"`,
    };
  }

  return {
    ok: true,
    element: el,
    matchedLabel,
    matchedRole,
  };
}

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

export function inferElementRole(el: Element): string {
  return inferRole(el);
}
