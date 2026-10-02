import { inferElementRole } from "../verify-element";
import { choiceOptionLabel, findVisibleChoiceOption, isProxyControl } from "./choice-group";
import { isChoiceSelected } from "./choice-state";
import { findAssociatedCombobox, findComboboxForOption } from "./enhanced-select";
import { fillNativeSelect } from "./native-select";
import { pointerActivate } from "./pointer-activate";
import { selectComboboxOption } from "./select-combobox";

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function optionLabel(el: Element): string {
  const html = el as HTMLElement;
  const id = html.id;
  const byFor =
    id && html.ownerDocument
      ? html.ownerDocument.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent
      : null;
  const wrapping = html.closest("label")?.textContent;
  return (
    html.getAttribute("aria-label") ||
    byFor ||
    wrapping ||
    html.getAttribute("value") ||
    (html instanceof HTMLInputElement ? html.value : "") ||
    html.innerText ||
    html.textContent ||
    ""
  )
    .replace(/\s+/g, " ")
    .trim();
}

function labelsMatch(option: Element, value: string): boolean {
  const n = normalize(value);
  if (!n) return false;
  const label = normalize(optionLabel(option));
  const rawValue = option instanceof HTMLInputElement ? normalize(option.value) : "";
  return label === n || rawValue === n || label.includes(n) || n.includes(label);
}

function isBooleanIntent(value: string): boolean {
  return /^(true|yes|1|on|checked|false|no|0|off|unchecked)$/i.test(value.trim());
}

function wantChecked(value: string): boolean {
  return /^(true|yes|1|on|checked)$/i.test(value.trim());
}

function isDisplayed(el: HTMLElement): boolean {
  if (el.getClientRects().length === 0) return false;
  const style = el.ownerDocument?.defaultView?.getComputedStyle(el);
  if (!style) return Boolean(el.offsetParent);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

function findDisplayedOption(listbox: Element | null, value: string): HTMLElement | null {
  if (!listbox) return null;
  const nodes = Array.from(listbox.querySelectorAll('[role="option"]')).filter(
    (node): node is HTMLElement => node instanceof HTMLElement && isDisplayed(node),
  );
  return nodes.find((node) => labelsMatch(node, value)) || null;
}

function groupRoot(el: HTMLElement): ParentNode {
  return (
    el.closest(
      'fieldset, [role="group"], [role="radiogroup"], [class*="Field"], [class*="field"], td, th, form',
    ) ||
    el.parentElement ||
    el.ownerDocument ||
    document
  );
}

function findChoiceInGroup(
  root: ParentNode,
  value: string,
  kind: "checkbox" | "radio",
): HTMLInputElement | null {
  const nodes = Array.from(root.querySelectorAll(`input[type="${kind}"]`));
  const match = nodes.find((node) => labelsMatch(node, value));
  return match instanceof HTMLInputElement ? match : null;
}

function findAriaChoice(root: ParentNode, value: string): HTMLElement | null {
  const nodes = Array.from(root.querySelectorAll('[role="checkbox"], [role="radio"]')).filter(
    (node): node is HTMLElement => node instanceof HTMLElement,
  );
  return nodes.find((node) => labelsMatch(node, value)) || null;
}

function findButtonChoice(root: ParentNode, value: string): HTMLElement | null {
  const nodes = Array.from(
    root.querySelectorAll('button, [role="button"], [role="radio"], [aria-pressed]'),
  ).filter((node): node is HTMLElement => node instanceof HTMLElement && isDisplayed(node));
  return nodes.find((node) => labelsMatch(node, value)) || null;
}

function ensureChecked(el: HTMLInputElement, intended?: string): string {
  if (!el.checked) pointerActivate(el, intended);
  return optionLabel(el) || el.value || "checked";
}

/**
 * Select a radio/checkbox option by boolean intent or visible option label.
 * Supports native inputs and ARIA role=checkbox/radio widgets.
 */
export async function selectRadioElement(el: Element, value: string | null): Promise<string> {
  const html = el as HTMLElement;
  html.scrollIntoView({ block: "center", behavior: "auto" });

  const role = inferElementRole(el);
  if (el instanceof HTMLSelectElement && value) {
    const combo = findAssociatedCombobox(el);
    if (combo && combo !== el) return selectComboboxOption(combo, value);
    return fillNativeSelect(el, value);
  }
  if ((role === "combobox" || html.getAttribute("aria-haspopup") === "listbox") && value) {
    return selectComboboxOption(el, value);
  }

  const intended = value?.trim() || "";

  // Planner often targets role=option nodes for custom dropdowns — drive the parent combobox.
  const explicitAriaRole = (html.getAttribute("role") || "").toLowerCase();
  if (explicitAriaRole === "option" || el instanceof HTMLOptionElement) {
    const label = intended || optionLabel(html);

    if (el instanceof HTMLOptionElement) {
      const select = el.closest("select");
      if (select instanceof HTMLSelectElement) {
        const combo = findAssociatedCombobox(select);
        if (combo && label) return selectComboboxOption(combo, label);
        select.value = el.value;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return optionLabel(el) || label;
      }
    }

    const combo = findComboboxForOption(html);
    if (combo && label) return selectComboboxOption(combo, label);

    const visible = findDisplayedOption(html.closest('[role="listbox"]'), label);
    if (visible) {
      pointerActivate(visible);
      return optionLabel(visible) || label;
    }
    if (isDisplayed(html)) {
      pointerActivate(html);
      return optionLabel(html) || label;
    }
    throw new Error(`Dropdown option "${label}" is not open — no combobox trigger found`);
  }

  // A native input nobody can see is a proxy for the field's visible options.
  // Toggling it cannot express a negative answer (unchecked is the resting
  // state), so activate the visible option carrying the intended label instead.
  if (
    el instanceof HTMLInputElement &&
    (el.type === "radio" || el.type === "checkbox") &&
    intended &&
    isProxyControl(el)
  ) {
    const option = findVisibleChoiceOption(el, intended);
    if (option) {
      if (!isChoiceSelected(option)) pointerActivate(option);
      return choiceOptionLabel(option) || intended;
    }
  }

  if (el instanceof HTMLInputElement && el.type === "radio") {
    if (intended && !isBooleanIntent(intended) && !labelsMatch(el, intended)) {
      const grouped = findChoiceInGroup(groupRoot(html), intended, "radio");
      if (grouped) return ensureChecked(grouped, intended);
      throw new Error(`No radio option matching "${intended}"`);
    }
    return ensureChecked(el, intended);
  }

  if (el instanceof HTMLInputElement && el.type === "checkbox") {
    if (intended && !isBooleanIntent(intended)) {
      if (labelsMatch(el, intended)) return ensureChecked(el, intended);
      const grouped = findChoiceInGroup(groupRoot(html), intended, "checkbox");
      if (grouped) return ensureChecked(grouped, intended);
      throw new Error(`No checkbox option matching "${intended}"`);
    }
    const check = !intended || wantChecked(intended);
    if (el.checked !== check) pointerActivate(el);
    return String(el.checked);
  }

  // ARIA checkbox/radio without native input
  if ((explicitAriaRole === "checkbox" || explicitAriaRole === "radio") && intended) {
    if (isBooleanIntent(intended) || labelsMatch(html, intended)) {
      const pressed =
        html.getAttribute("aria-checked") === "true" ||
        html.getAttribute("aria-pressed") === "true";
      if (!pressed) pointerActivate(html);
      return optionLabel(html) || "checked";
    }
  }

  // Custom choice buttons: the planned node is the option to activate.
  if (el instanceof HTMLButtonElement && intended && labelsMatch(html, intended)) {
    pointerActivate(html);
    return optionLabel(html) || intended;
  }

  if (intended) {
    const root = groupRoot(html);
    const checkbox = findChoiceInGroup(root, intended, "checkbox");
    if (checkbox) return ensureChecked(checkbox, intended);
    const radio = findChoiceInGroup(root, intended, "radio");
    if (radio) return ensureChecked(radio, intended);
    const aria = findAriaChoice(root, intended);
    if (aria) {
      pointerActivate(aria);
      return optionLabel(aria) || intended;
    }
    const button = findButtonChoice(root, intended);
    if (button) {
      pointerActivate(button);
      return optionLabel(button) || intended;
    }
  }

  const root = groupRoot(html);
  const radios = Array.from(root.querySelectorAll('input[type="radio"]'));
  if (radios.length && intended) {
    const target = findChoiceInGroup(root, intended, "radio");
    if (!target) throw new Error(`No radio option matching "${intended}"`);
    return ensureChecked(target, intended);
  }

  if (intended) {
    return selectComboboxOption(el, intended);
  }

  pointerActivate(html);
  return optionLabel(el) || "clicked";
}
