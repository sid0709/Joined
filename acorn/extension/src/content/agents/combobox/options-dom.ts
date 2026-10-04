export function normalize(text: string): string {
  return text.replace(/\s+/g, " ").replace(/[–—]/g, "-").trim().toLowerCase();
}

export function optionText(el: Element): string {
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

export function isDisplayed(el: HTMLElement): boolean {
  if (el.getClientRects().length === 0) return false;
  const style = el.ownerDocument?.defaultView?.getComputedStyle(el);
  if (!style) return Boolean(el.offsetParent);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
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

export function collectOptionsInRoot(root: ParentNode): HTMLElement[] {
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

export function pickScopedOptions(control: HTMLElement, doc: Document): HTMLElement[] {
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

export function optionSignature(options: HTMLElement[]): string {
  return options.map((opt) => normalize(optionText(opt))).join("\n");
}

export function displayedListboxes(control: HTMLElement, doc: Document): HTMLElement[] {
  const owned = listboxRootsForControl(control, doc).filter(
    (node) => isDisplayed(node) || collectOptionsInRoot(node).length > 0,
  );
  if (owned.length) return owned;
  return Array.from(doc.querySelectorAll('[role="listbox"]')).filter(
    (node): node is HTMLElement => node instanceof HTMLElement && isDisplayed(node),
  );
}
