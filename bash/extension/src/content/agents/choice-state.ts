/** ARIA roles whose accessible name is the option label, not a filled value. */
const CHOICE_ROLES = ["option", "radio", "checkbox", "switch"] as const;

const ARIA_TRUE = "true";

function choiceRole(el: Element): string {
  return ((el as HTMLElement).getAttribute?.("role") || "").toLowerCase();
}

/**
 * Widgets that always expose their own option label in text.
 * A label match is only a filled answer when the widget is selected.
 */
export function isChoiceWidget(el: Element): boolean {
  if (el instanceof HTMLOptionElement || el instanceof HTMLButtonElement) return true;
  if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
    return true;
  }
  const role = choiceRole(el);
  return (CHOICE_ROLES as readonly string[]).includes(role);
}

/** Native checked/selected or ARIA checked/pressed/selected — not CSS class names. */
export function isChoiceSelected(el: Element): boolean {
  if (el instanceof HTMLOptionElement) return el.selected;
  if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
    return el.checked;
  }
  const html = el as HTMLElement;
  return (
    html.getAttribute("aria-selected") === ARIA_TRUE ||
    html.getAttribute("aria-checked") === ARIA_TRUE ||
    html.getAttribute("aria-pressed") === ARIA_TRUE
  );
}
