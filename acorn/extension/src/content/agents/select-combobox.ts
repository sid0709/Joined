import { resolveDropdownInteractionTarget } from "./enhanced-select";
import { askAiMatchOption } from "./match-option-client";
import { fillNativeSelect } from "./native-select";
import { pointerActivate } from "./pointer-activate";
import { readControlValue } from "./read-control-value";
import { stripChoiceMarker } from "./string-similarity";
import { waitMs } from "./wait";

/** Delay between keystrokes when appending a typed word. */
const SMOOTH_TYPE_DELAY_MS = 45;
/** Settle time after each typed word so filtered options can render. */
const WORD_SEARCH_SETTLE_MS = 320;
const OPTION_WAIT_MS = 3000;
/** Typeahead lists are large; closed menus already show every choice. */
const CLOSED_LIST_MAX = 48;

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").replace(/[–—]/g, "-").trim().toLowerCase();
}

function optionText(el: Element): string {
  return ((el as HTMLElement).innerText || el.textContent || "").replace(/\s+/g, " ").trim();
}

function isPlaceholderOption(text: string): boolean {
  const n = normalize(text);
  if (!n) return true;
  const stripped = n.replace(/^[—\-–•·.|]+|[—\-–•·.|]+$/g, "").trim();
  if (!stripped) return true;
  return /^(select(\s|$)|choose(\s|$)|pick(\s|$)|make a selection|type to search|please select|no results|no matches|nothing found|no options)/i.test(
    stripped,
  );
}

function isDisplayed(el: HTMLElement): boolean {
  if (el.getClientRects().length === 0) return false;
  const style = el.ownerDocument?.defaultView?.getComputedStyle(el);
  if (!style) return Boolean(el.offsetParent);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

function dismissOpenOverlays(doc: Document, control: HTMLElement): void {
  control.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
  );
  doc.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
  );
}

function collectRefIds(el: HTMLElement): string[] {
  return [el.getAttribute("aria-controls"), el.getAttribute("aria-owns"), el.getAttribute("list")]
    .filter(Boolean)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean);
}

function listboxRootsForControl(control: HTMLElement, doc: Document): HTMLElement[] {
  const roots: HTMLElement[] = [];
  const seen = new Set<string>();

  const addIds = (ids: string[]) => {
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      const node = doc.getElementById(id);
      if (node instanceof HTMLElement) roots.push(node);
    }
  };

  addIds(collectRefIds(control));

  // Custom widgets often put aria-owns on a sibling/ancestor container, not the trigger.
  let node: HTMLElement | null = control.parentElement;
  for (let depth = 0; depth < 5 && node; depth++) {
    addIds(collectRefIds(node));
    for (const child of Array.from(node.children)) {
      if (child instanceof HTMLElement) addIds(collectRefIds(child));
    }
    node = node.parentElement;
  }

  return roots;
}

function collectOptionsInRoot(root: ParentNode): HTMLElement[] {
  const selectors = [
    '[role="option"]',
    '[role="listbox"] [role="option"]',
    '[role="listbox"] li',
    'ul[role="listbox"] li',
  ];
  const found = new Set<HTMLElement>();
  for (const selector of selectors) {
    for (const node of Array.from(root.querySelectorAll(selector))) {
      const html = node as HTMLElement;
      if (!isDisplayed(html)) continue;
      const text = optionText(html);
      if (!text || text.length > 200 || isPlaceholderOption(text)) continue;
      found.add(html);
    }
  }
  return Array.from(found);
}

function scoreListbox(listbox: HTMLElement, control: HTMLElement): number {
  const controlRect = control.getBoundingClientRect();
  const boxRect = listbox.getBoundingClientRect();
  if (boxRect.width === 0 && boxRect.height === 0) return Number.POSITIVE_INFINITY;
  return Math.abs(boxRect.left - controlRect.left) + Math.abs(boxRect.top - controlRect.bottom);
}

function nearestComboboxTo(listbox: HTMLElement, doc: Document): HTMLElement | null {
  const combos = Array.from(
    doc.querySelectorAll('[role="combobox"], select, [aria-haspopup="listbox"]'),
  ).filter((node): node is HTMLElement => node instanceof HTMLElement && isDisplayed(node));
  if (!combos.length) return null;
  let best: HTMLElement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const combo of combos) {
    const score = scoreListbox(listbox, combo);
    if (score < bestScore) {
      bestScore = score;
      best = combo;
    }
  }
  return best;
}

function listboxServesControl(listbox: HTMLElement, control: HTMLElement, doc: Document): boolean {
  const nearest = nearestComboboxTo(listbox, doc);
  if (!nearest) return true;
  return nearest === control || control.contains(nearest) || nearest.contains(control);
}

function pickScopedOptions(control: HTMLElement, doc: Document): HTMLElement[] {
  const owned = listboxRootsForControl(control, doc);
  if (owned.length) {
    for (const root of owned) {
      const options = collectOptionsInRoot(root);
      if (options.length) return options;
    }
    // Owned menu exists but is empty — wait rather than stealing another field's list.
    return [];
  }

  const listboxes = Array.from(doc.querySelectorAll('[role="listbox"]')).filter(
    (node): node is HTMLElement =>
      node instanceof HTMLElement && isDisplayed(node) && listboxServesControl(node, control, doc),
  );
  listboxes.sort((a, b) => scoreListbox(a, control) - scoreListbox(b, control));
  for (const listbox of listboxes) {
    const options = collectOptionsInRoot(listbox);
    if (options.length) return options;
  }

  const container = control.closest('fieldset, [role="group"], label') || control.parentElement;
  if (container) {
    const local = collectOptionsInRoot(container);
    if (local.length) return local;
  }

  return [];
}

function optionSignature(options: HTMLElement[]): string {
  return options.map((opt) => normalize(optionText(opt))).join("\n");
}

/** Wait until the visible list is no longer the pre-type snapshot, then settle. */
async function waitForFilteredOptions(
  control: HTMLElement,
  doc: Document,
  previousSig: string,
  maxMs = OPTION_WAIT_MS,
): Promise<HTMLElement[]> {
  const started = Date.now();
  let lastSig = previousSig;
  let stableAt = Date.now();
  let last: HTMLElement[] = pickScopedOptions(control, doc);
  while (Date.now() - started < maxMs) {
    const options = pickScopedOptions(control, doc);
    const sig = optionSignature(options);
    if (sig !== lastSig) {
      lastSig = sig;
      stableAt = Date.now();
      last = options;
    } else if (options.length && sig !== previousSig && Date.now() - stableAt >= 200) {
      return options;
    }
    await waitMs(50);
  }
  return last.length && optionSignature(last) !== previousSig
    ? last
    : pickScopedOptions(control, doc);
}

async function waitForStableOptions(
  control: HTMLElement,
  doc: Document,
  maxMs = OPTION_WAIT_MS,
): Promise<HTMLElement[]> {
  const started = Date.now();
  let lastSig = "";
  let stableAt = Date.now();
  let last: HTMLElement[] = [];
  while (Date.now() - started < maxMs) {
    const options = pickScopedOptions(control, doc);
    const sig = optionSignature(options);
    if (sig !== lastSig) {
      lastSig = sig;
      stableAt = Date.now();
      last = options;
    } else if (options.length && Date.now() - stableAt >= 200) {
      return options;
    }
    await waitMs(50);
  }
  return last.length ? last : pickScopedOptions(control, doc);
}

function displayedListboxes(control: HTMLElement, doc: Document): HTMLElement[] {
  const owned = listboxRootsForControl(control, doc).filter(
    (node) => isDisplayed(node) || collectOptionsInRoot(node).length > 0,
  );
  if (owned.length) return owned;
  return Array.from(doc.querySelectorAll('[role="listbox"]')).filter(
    (node): node is HTMLElement => node instanceof HTMLElement && isDisplayed(node),
  );
}

async function collectOptionsByScrolling(
  control: HTMLElement,
  doc: Document,
): Promise<HTMLElement[]> {
  const byKey = new Map<string, HTMLElement>();
  const add = (opts: HTMLElement[]) => {
    for (const opt of opts) {
      const key = normalize(optionText(opt));
      if (key && !byKey.has(key)) byKey.set(key, opt);
    }
  };

  add(pickScopedOptions(control, doc));
  const boxes = displayedListboxes(control, doc);
  const scrollTargets = new Set<HTMLElement>();
  for (const box of boxes) {
    if (box.scrollHeight > box.clientHeight + 8) scrollTargets.add(box);
    for (const child of Array.from(box.children)) {
      if (child instanceof HTMLElement && child.scrollHeight > child.clientHeight + 8) {
        scrollTargets.add(child);
      }
    }
  }

  const targets = scrollTargets.size ? [...scrollTargets] : boxes;
  for (const box of targets) {
    const maxScroll = Math.max(0, box.scrollHeight - box.clientHeight);
    if (maxScroll <= 0) {
      add(collectOptionsInRoot(box));
      continue;
    }
    const steps = 10;
    for (let i = 0; i <= steps; i += 1) {
      box.scrollTop = (maxScroll * i) / steps;
      await waitMs(40);
      add(collectOptionsInRoot(box));
      add(pickScopedOptions(control, doc));
    }
    box.scrollTop = 0;
  }
  return Array.from(byKey.values());
}

async function findLiveOption(
  control: HTMLElement,
  doc: Document,
  label: string,
): Promise<HTMLElement | null> {
  const want = normalize(label);
  const visible = pickScopedOptions(control, doc).find(
    (opt) => normalize(optionText(opt)) === want,
  );
  if (visible?.isConnected) return visible;

  const scrolled = await collectOptionsByScrolling(control, doc);
  const live = scrolled.find((opt) => opt.isConnected && normalize(optionText(opt)) === want);
  if (live) return live;

  const boxes = displayedListboxes(control, doc);
  for (const box of boxes) {
    const maxScroll = Math.max(0, box.scrollHeight - box.clientHeight);
    const steps = 10;
    for (let i = 0; i <= steps; i += 1) {
      box.scrollTop = maxScroll ? (maxScroll * i) / steps : 0;
      await waitMs(40);
      const hit = collectOptionsInRoot(box).find(
        (opt) => opt.isConnected && normalize(optionText(opt)) === want,
      );
      if (hit) return hit;
    }
  }
  return null;
}

async function openAndCollectOptions(html: HTMLElement, doc: Document): Promise<HTMLElement[]> {
  await focusAndOpenCombobox(html);
  let options = await waitForStableOptions(html, doc);
  if (!options.length) {
    html.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }),
    );
    options = await waitForStableOptions(html, doc);
  }
  const scrolled = await collectOptionsByScrolling(html, doc);
  return scrolled.length >= options.length ? scrolled : options;
}

function findLocalMatch(
  options: HTMLElement[],
  value: string,
  _fieldLabel?: string | null,
): { match: HTMLElement | null; score: number | null; strategy: string } {
  return matchLocally(options, value);
}

function matchLocally(
  options: HTMLElement[],
  value: string,
): { match: HTMLElement | null; score: number | null; strategy: string } {
  const target = normalize(value);
  const targetBare = normalize(stripChoiceMarker(value));
  if (!target) return { match: null, score: null, strategy: "empty" };

  const exact = options.find((opt) => {
    const have = normalize(optionText(opt));
    const haveBare = normalize(stripChoiceMarker(optionText(opt)));
    return have === target || haveBare === targetBare;
  });
  if (exact) return { match: exact, score: 1, strategy: "exact" };
  return { match: null, score: null, strategy: "none" };
}

function optionKey(text: string): string {
  return normalize(stripChoiceMarker(text))
    .replace(/[^\p{L}\p{N}+]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveOptionElement(options: HTMLElement[], label: string): HTMLElement | null {
  const want = optionKey(label);
  return (
    options.find((opt) => optionText(opt) === label) ||
    options.find((opt) => normalize(optionText(opt)) === normalize(label)) ||
    (want ? options.find((opt) => optionKey(optionText(opt)) === want) || null : null)
  );
}

async function focusAndOpenCombobox(el: HTMLElement): Promise<void> {
  el.scrollIntoView({ block: "center", behavior: "auto" });
  el.focus?.();
  pointerActivate(el);
  await waitMs(80);
  // Clear any leftover filter text so the full option list is visible.
  const input = resolveTypeableInput(el);
  if (input) {
    input.removeAttribute("aria-hidden");
    setInputValue(input, "");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await waitMs(60);
  }
}

function resolveTypeableInput(el: HTMLElement): HTMLInputElement | HTMLTextAreaElement | null {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el;
  const root = el.parentElement || el;
  const candidates = Array.from(
    root.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea',
    ),
  ).filter((node): node is HTMLInputElement | HTMLTextAreaElement => {
    if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement)) return false;
    const role = (node.getAttribute("role") || "").toLowerCase();
    return (
      role === "combobox" ||
      node.getAttribute("aria-autocomplete") === "list" ||
      node.type === "search" ||
      node.type === "text"
    );
  });
  return candidates.find((node) => isDisplayed(node as HTMLElement)) || candidates[0] || null;
}

function setInputValue(el: HTMLInputElement | HTMLTextAreaElement, text: string): void {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, text);
  else el.value = text;
}

function typeaheadFilterWaitMs(doc: Document): number {
  return doc.hidden ? 8000 : 4000;
}

/** Set the whole search string at once so the host queries the full school name. */
async function pasteQueryIntoOpenCombobox(el: HTMLElement, query: string): Promise<void> {
  const input = resolveTypeableInput(el);
  if (!input) return;
  input.removeAttribute("aria-hidden");
  input.focus();
  setInputValue(input, "");
  input.dispatchEvent(new Event("input", { bubbles: true }));
  setInputValue(input, query);
  input.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      data: query,
      inputType: "insertText",
    }),
  );
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await waitMs(el.ownerDocument.hidden ? 1000 : WORD_SEARCH_SETTLE_MS);
}

/** Type the full query string into an already-focused open combobox. */
async function typeQueryIntoOpenCombobox(el: HTMLElement, query: string): Promise<void> {
  const input = resolveTypeableInput(el);
  if (!input) return;
  // Nested search inputs are often aria-hidden until the menu opens.
  input.removeAttribute("aria-hidden");
  input.focus();
  setInputValue(input, "");
  input.dispatchEvent(new Event("input", { bubbles: true }));

  let built = "";
  for (const ch of query) {
    built += ch;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: ch, bubbles: true, cancelable: true }));
    setInputValue(input, built);
    input.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        data: ch,
        inputType: "insertText",
      }),
    );
    input.dispatchEvent(new KeyboardEvent("keyup", { key: ch, bubbles: true, cancelable: true }));
    await waitMs(SMOOTH_TYPE_DELAY_MS);
  }
  await waitMs(WORD_SEARCH_SETTLE_MS);
}

/**
 * Closed lists already show every choice, so AI may pick a semantic equivalent.
 * Typeahead first pages are incomplete — only ask AI when the intended label is
 * already among the visible options, or after the full query has been typed.
 */
async function matchFromCandidates(
  options: HTMLElement[],
  value: string,
  fieldLabel: string | null,
  typedQuery: string | null,
  allowAi = true,
): Promise<{ match: HTMLElement | null; score: number | null; strategy: string }> {
  const local = findLocalMatch(options, value, fieldLabel);
  if (local.match) return local;

  if (!allowAi || !options.length) {
    return { match: null, score: local.score, strategy: local.strategy };
  }

  const labels = options.map(optionText);
  const ai = await askAiMatchOption({
    intendedValue: value,
    options: labels,
    fieldLabel,
    typedQuery,
  });

  const aiConfidence = typeof ai.confidence === "number" ? ai.confidence : 0;
  const el = ai.matched_option ? resolveOptionElement(options, ai.matched_option) : null;
  // Confidence 0 means the model did not consider this the intended entity.
  if (el && aiConfidence > 0) {
    return {
      match: el,
      score: aiConfidence,
      strategy: "ai",
    };
  }

  return { match: null, score: local.score, strategy: local.strategy };
}

/**
 * 1) Focus → collect initial candidates → local match → AI match on closed lists
 * 2) Typeahead: paste the full query, wait for the filtered list, then match
 */
export async function selectComboboxOption(
  el: Element,
  value: string,
  fieldHint?: string | null,
): Promise<string> {
  const requested = el as HTMLElement;
  if (requested instanceof HTMLSelectElement) {
    return fillNativeSelect(requested, value);
  }
  const html = resolveDropdownInteractionTarget(requested);
  if (html instanceof HTMLSelectElement) {
    return fillNativeSelect(html, value);
  }
  const doc = html.ownerDocument || document;
  const fromDom =
    html.getAttribute("aria-label") ||
    requested.getAttribute("aria-label") ||
    (html.id
      ? doc.querySelector(`label[for="${CSS.escape(html.id)}"]`)?.textContent?.trim()
      : null) ||
    (requested.id
      ? doc.querySelector(`label[for="${CSS.escape(requested.id)}"]`)?.textContent?.trim()
      : null) ||
    null;
  const fieldLabel =
    [fieldHint, fromDom]
      .map((part) =>
        String(part || "")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .filter(Boolean)
      .filter(
        (part, i, all) =>
          all.findIndex((other) => other.toLowerCase() === part.toLowerCase()) === i,
      )
      .join(" ") || null;

  dismissOpenOverlays(doc, html);
  await waitMs(40);
  let options = await openAndCollectOptions(html, doc);

  const intendedInList = (list: HTMLElement[]) => {
    const want = normalize(value);
    return list.some((opt) => {
      const have = normalize(optionText(opt));
      return have === want || have.includes(want) || want.includes(have);
    });
  };

  const initialOptions = options;
  const closedList = initialOptions.length > 0 && initialOptions.length <= CLOSED_LIST_MAX;
  const allowInitialAi = closedList || intendedInList(initialOptions);
  let { match } = await matchFromCandidates(options, value, fieldLabel, null, allowInitialAi);

  // Typeahead: type the full query and wait for the list to change.
  // Closed menus already show every candidate — typing filters them away.
  const typeable = resolveTypeableInput(html);
  if (!match && !closedList && typeable && value.trim().length >= 2) {
    const query = value.trim();
    const priorSig = optionSignature(initialOptions);
    const filterWait = typeaheadFilterWaitMs(doc);

    await focusAndOpenCombobox(html);
    await pasteQueryIntoOpenCombobox(html, query);
    let filtered = await waitForFilteredOptions(html, doc, priorSig, filterWait);
    let typed = query;

    if (!intendedInList(filtered) && optionSignature(filtered) === priorSig) {
      await focusAndOpenCombobox(html);
      await typeQueryIntoOpenCombobox(html, query);
      filtered = await waitForFilteredOptions(html, doc, priorSig, filterWait);
    }

    if (filtered.length) {
      options = filtered;
      const allowAi = intendedInList(filtered);
      const resolved = await matchFromCandidates(options, value, fieldLabel, typed, allowAi);
      match = resolved.match;
    }

    if (!match) {
      const words = query.split(/\s+/).filter(Boolean);
      typed = "";
      for (let i = 0; i < words.length; i += 1) {
        const word = words[i];
        typed = typed ? `${typed} ${word}` : word;
        await focusAndOpenCombobox(html);
        await typeQueryIntoOpenCombobox(html, typed);
        filtered = await waitForFilteredOptions(html, doc, priorSig, filterWait);
        if (!filtered.length) {
          options = initialOptions.length ? initialOptions : await openAndCollectOptions(html, doc);
          break;
        }
        options = filtered;
        const lastWord = i === words.length - 1;
        const allowAi = lastWord || intendedInList(filtered);
        const resolved = await matchFromCandidates(options, value, fieldLabel, typed, allowAi);
        match = resolved.match;
        if (match) break;
      }
    }
  }

  if (!match && initialOptions.length === 0) {
    dismissOpenOverlays(doc, html);
    await waitMs(450);
    options = await openAndCollectOptions(html, doc);
    const resolved = await matchFromCandidates(options, value, fieldLabel, null);
    match = resolved.match;
  } else if (!match) {
    options = initialOptions;
  }

  if (!match) {
    dismissOpenOverlays(doc, html);
    const sawFrom = options.length ? options : initialOptions;
    throw new Error(
      `No combobox option matching "${value}" (saw: ${sawFrom
        .slice(0, 6)
        .map(optionText)
        .join(" | ")})`,
    );
  }

  const label = optionText(match);
  const live = match.isConnected ? match : await findLiveOption(html, doc, label);
  const clickTarget = live || match;
  clickTarget.scrollIntoView({ block: "nearest", behavior: "auto" });
  pointerActivate(clickTarget);
  await waitMs(80);
  dismissOpenOverlays(doc, html);

  const displayed = readControlValue(html);
  const selected =
    displayed ||
    (html instanceof HTMLInputElement && html.value) ||
    html.getAttribute("data-value") ||
    optionText(match);

  return selected;
}
