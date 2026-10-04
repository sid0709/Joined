import { waitMs } from "../wait";
import {
  collectOptionsInRoot,
  displayedListboxes,
  normalize,
  optionSignature,
  optionText,
  pickScopedOptions,
} from "./options-dom";
import { focusAndOpenCombobox } from "./typing";

const OPTION_WAIT_MS = 3000;

/** Wait until the visible list is no longer the pre-type snapshot, then settle. */
export async function waitForFilteredOptions(
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

export async function findLiveOption(
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

export async function openAndCollectOptions(
  html: HTMLElement,
  doc: Document,
): Promise<HTMLElement[]> {
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
