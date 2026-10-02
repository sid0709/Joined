/**
 * Pair native <select> / nested search inputs with their custom listbox trigger.
 * Vendor-agnostic: ARIA roles + id/sibling structure only.
 */

function isDisplayed(el: HTMLElement): boolean {
  if (el.getClientRects().length === 0) return false;
  const style = el.ownerDocument?.defaultView?.getComputedStyle(el);
  if (!style) return Boolean(el.offsetParent);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

function comboboxCandidates(root: ParentNode, exclude?: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll('[role="combobox"]')).filter(
    (node): node is HTMLElement => {
      if (!(node instanceof HTMLElement) || node === exclude) return false;
      if (node.getAttribute("aria-hidden") === "true") return false;
      if (node.closest('[role="listbox"]')) return false;
      return true;
    },
  );
}

/** Prefer comboboxes whose id is clearly paired with the source control id. */
function idLinkedCombobox(sourceId: string, combos: HTMLElement[]): HTMLElement | null {
  if (!sourceId) return null;
  const exact = combos.find((el) => el.id === sourceId);
  if (exact) return exact;
  const prefixed = combos.find(
    (el) => el.id.startsWith(`${sourceId}_`) || el.id.startsWith(`${sourceId}-`),
  );
  if (prefixed) return prefixed;
  return (
    combos.find((el) => {
      const controls = el.getAttribute("aria-controls") || "";
      const owns = el.getAttribute("aria-owns") || "";
      return controls.split(/\s+/).includes(sourceId) || owns.split(/\s+/).includes(sourceId);
    }) || null
  );
}

function pickPreferredCombobox(combos: HTMLElement[]): HTMLElement | null {
  if (!combos.length) return null;
  const nonInputs = combos.filter(
    (node) => node.tagName !== "INPUT" && node.tagName !== "TEXTAREA",
  );
  return (
    nonInputs.find((node) => isDisplayed(node)) ||
    nonInputs[0] ||
    combos.find((node) => isDisplayed(node)) ||
    combos[0] ||
    null
  );
}

/**
 * Resolve the interaction target for a dropdown widget.
 * When the source has an id, only pair with an id-linked combobox (or a sibling
 * in the immediate field cell) — never a distant combobox in a large ancestor.
 */
export function resolveDropdownInteractionTarget(el: HTMLElement): HTMLElement {
  if (el instanceof HTMLSelectElement) {
    return findAssociatedCombobox(el) || el;
  }

  const role = (el.getAttribute("role") || "").toLowerCase();
  const isSearchLike =
    role === "combobox" &&
    (el instanceof HTMLInputElement || el.getAttribute("aria-hidden") === "true");

  if (!isSearchLike && role === "combobox" && isDisplayed(el)) {
    return el;
  }

  // Nested/hidden search input → find sibling trigger via nearby select id or parent.
  const parent = el.parentElement;
  if (parent) {
    const select = parent.querySelector("select");
    if (select instanceof HTMLSelectElement) {
      const linked = findAssociatedCombobox(select);
      if (linked) return linked;
    }
    const local = pickPreferredCombobox(comboboxCandidates(parent, el));
    if (local) return local;
  }

  // One more level (field cell), still avoiding the whole form.
  const grand = parent?.parentElement;
  if (grand) {
    const select = grand.querySelector("select");
    if (select instanceof HTMLSelectElement) {
      const linked = findAssociatedCombobox(select);
      if (linked) return linked;
    }
    const local = pickPreferredCombobox(comboboxCandidates(grand, el));
    if (local && local !== el) return local;
  }

  return el;
}

/** Find the interactive combobox trigger paired with a native <select>. */
export function findAssociatedCombobox(select: HTMLSelectElement): HTMLElement | null {
  // 1) Immediate parent / field cell — strongest structural pairing.
  const nearRoots: HTMLElement[] = [];
  if (select.parentElement) nearRoots.push(select.parentElement);
  if (select.parentElement?.parentElement) {
    nearRoots.push(select.parentElement.parentElement);
  }

  for (const root of nearRoots) {
    const combos = comboboxCandidates(root, select);
    if (select.id) {
      const linked = idLinkedCombobox(select.id, combos);
      if (linked) return linked;
    }
    if (combos.length === 1) return combos[0];
    const preferred = pickPreferredCombobox(combos);
    // Only accept multi-combo near-roots when id-linked; otherwise too ambiguous.
    if (select.id) continue;
    if (preferred) return preferred;
  }

  // 2) Wider search only for id-linked pairs (safe across large address blocks).
  if (select.id) {
    const scope =
      (select.closest(
        'td, th, [class*="Field"], [class*="field"], fieldset, form',
      ) as HTMLElement | null) || select.ownerDocument?.body;
    if (scope) {
      const linked = idLinkedCombobox(select.id, comboboxCandidates(scope, select));
      if (linked) return linked;
    }
  }

  return null;
}

function tokenIds(value: string | null): string[] {
  return (value || "")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function idPrefixesListbox(el: HTMLElement, listboxId: string): boolean {
  if (!el.id || !listboxId) return false;
  return (
    listboxId === el.id || listboxId.startsWith(`${el.id}_`) || listboxId.startsWith(`${el.id}-`)
  );
}

/**
 * Listboxes are often owned by a wrapper (aria-owns / aria-controls) that is
 * not itself role=combobox. The interactive trigger is a sibling in the same cell.
 */
function findAriaOwner(listbox: HTMLElement): HTMLElement | null {
  const id = listbox.id;
  if (!id) return null;
  const matches: HTMLElement[] = [];
  for (const node of Array.from(
    listbox.ownerDocument.querySelectorAll("[aria-owns], [aria-controls]"),
  )) {
    if (!(node instanceof HTMLElement) || node === listbox) continue;
    const refs = [
      ...tokenIds(node.getAttribute("aria-owns")),
      ...tokenIds(node.getAttribute("aria-controls")),
    ];
    if (refs.includes(id)) matches.push(node);
  }
  if (!matches.length) return null;
  const ancestors = matches.filter((el) => el.contains(listbox));
  const pool = ancestors.length ? ancestors : matches;
  return pool.reduce((best, el) => (best.contains(el) ? el : best));
}

function comboboxNearOwner(owner: HTMLElement, option: HTMLElement): HTMLElement | null {
  const role = (owner.getAttribute("role") || "").toLowerCase();
  if (role === "combobox" && owner.getAttribute("aria-hidden") !== "true") {
    return resolveDropdownInteractionTarget(owner);
  }
  const parent = owner.parentElement;
  if (!parent || parent.tagName === "BODY" || parent.tagName === "HTML") return null;
  const select = parent.querySelector("select");
  if (select instanceof HTMLSelectElement) {
    const linked = findAssociatedCombobox(select);
    if (linked) return linked;
    const selects = parent.querySelectorAll("select");
    if (selects.length === 1) return select;
  }
  const combos = comboboxCandidates(parent, option);
  const displayed = combos.filter(isDisplayed);
  if (displayed.length === 1) return displayed[0];
  return pickPreferredCombobox(displayed.length ? displayed : combos);
}

function comboboxFromFieldRoot(
  root: HTMLElement,
  option: HTMLElement,
  listboxId: string,
): HTMLElement | null {
  if (root.tagName === "BODY" || root.tagName === "HTML" || root.tagName === "FORM") {
    return null;
  }
  const selects = Array.from(root.querySelectorAll("select")).filter(
    (node): node is HTMLSelectElement => node instanceof HTMLSelectElement,
  );
  if (selects.length === 1) {
    return findAssociatedCombobox(selects[0]) || selects[0];
  }
  if (listboxId && selects.length > 1) {
    const linkedSelect = selects.find((el) => idPrefixesListbox(el, listboxId));
    if (linkedSelect) return findAssociatedCombobox(linkedSelect) || linkedSelect;
  }
  const combos = comboboxCandidates(root, option);
  if (listboxId) {
    const prefixed = combos.find((el) => idPrefixesListbox(el, listboxId));
    if (prefixed) return resolveDropdownInteractionTarget(prefixed);
  }
  const displayed = combos.filter(isDisplayed);
  if (displayed.length === 1) return displayed[0];
  return null;
}

/**
 * Pair a role=option / <option> with the combobox that owns its listbox.
 * Listboxes are often portaled away from the field cell.
 */
export function findComboboxForOption(option: HTMLElement): HTMLElement | null {
  const doc = option.ownerDocument || document;
  if (option instanceof HTMLOptionElement) {
    const select = option.closest("select");
    if (select instanceof HTMLSelectElement) {
      return findAssociatedCombobox(select) || select;
    }
  }

  const listbox = option.closest('[role="listbox"]') as HTMLElement | null;
  const listboxId = listbox?.id || "";
  const optionId = option.id || "";

  const ownerByRef = (id: string): HTMLElement | null => {
    if (!id) return null;
    const scoped = comboboxCandidates(doc, option);
    return (
      scoped.find((el) => {
        const refs = [
          ...tokenIds(el.getAttribute("aria-controls")),
          ...tokenIds(el.getAttribute("aria-owns")),
        ];
        const active = el.getAttribute("aria-activedescendant") || "";
        return refs.includes(id) || active === id;
      }) || null
    );
  };

  /** `how` names the strategy that located the owner, for readability at call sites. */
  const finish = (found: HTMLElement | null, _how: string): HTMLElement | null => found;

  const byListbox = ownerByRef(listboxId);
  if (byListbox) return finish(byListbox, "combo-aria-ref");
  const byOption = ownerByRef(optionId);
  if (byOption) return finish(byOption, "combo-option-ref");

  for (const combo of comboboxCandidates(doc, option)) {
    const ids = [
      ...tokenIds(combo.getAttribute("aria-controls")),
      ...tokenIds(combo.getAttribute("aria-owns")),
    ];
    for (const id of ids) {
      const root = doc.getElementById(id);
      if (root && (root === option || root.contains(option))) {
        return finish(combo, "combo-contains-option");
      }
    }
  }

  const labelledBy = tokenIds(listbox?.getAttribute("aria-labelledby") || null);
  for (const id of labelledBy) {
    const node = doc.getElementById(id);
    if (node instanceof HTMLElement) {
      const role = (node.getAttribute("role") || "").toLowerCase();
      if (role === "combobox") return finish(node, "labelledby-combo");
      const nested = pickPreferredCombobox(comboboxCandidates(node, option));
      if (nested) return finish(nested, "labelledby-nested");
    }
  }

  if (listbox) {
    const owner = findAriaOwner(listbox);
    if (owner) {
      const near = comboboxNearOwner(owner, option);
      if (near) return finish(near, "aria-owner-cell");
    }
  }

  let node: HTMLElement | null = listbox || option;
  for (let depth = 0; depth < 8 && node; depth += 1) {
    const parent: HTMLElement | null = node.parentElement;
    if (!parent) break;
    const fromRoot = comboboxFromFieldRoot(parent, option, listboxId);
    if (fromRoot) return finish(fromRoot, `ancestor-${depth}`);
    node = parent;
  }

  return finish(null, "none");
}

function selectHasRealOptions(select: HTMLSelectElement): boolean {
  return Array.from(select.options).some((option) => {
    const label = (option.textContent || option.label || "").trim();
    const value = option.value.trim();
    if (!value && !label) return false;
    const n = label.toLowerCase().replace(/^[—\-–•·.\s|]+/, "");
    if (!n) return Boolean(value);
    if (/^(select|choose|pick|make a selection)/i.test(n)) return false;
    return true;
  });
}

/** True when the select is backed by a custom dropdown UI rather than the native picker. */
export function isEnhancedSelect(select: HTMLSelectElement): boolean {
  if (findAssociatedCombobox(select)) return true;
  const parent = select.parentElement;
  if (parent?.querySelector('[role="listbox"]') && !isDisplayed(select)) return true;
  if (
    !selectHasRealOptions(select) &&
    parent?.querySelector('[role="listbox"], [role="combobox"]')
  ) {
    return true;
  }
  return false;
}
