import {
  findAssociatedCombobox,
  isEnhancedSelect,
  resolveDropdownInteractionTarget,
} from "./enhanced-select";
import { fillNativeSelect } from "./native-select";
import { selectComboboxOption } from "./select-combobox";
import { selectRadioElement } from "./select-radio";
import { waitMs } from "./wait";

/** ARIA / structural combobox signals (no vendor class allowlists). */
function looksLikeCombobox(el: HTMLElement): boolean {
  const role = (el.getAttribute("role") || "").toLowerCase();
  if (role === "combobox" || role === "listbox") return true;
  if (el.getAttribute("aria-haspopup") === "listbox") return true;
  if (el.getAttribute("aria-autocomplete") === "list") return true;
  if (el.hasAttribute("aria-expanded") && el.hasAttribute("aria-controls")) return true;
  return false;
}

async function setNativeValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  text: string,
): Promise<void> {
  el.focus();
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const protoDesc = Object.getOwnPropertyDescriptor(proto, "value");
  const setter = protoDesc?.set;
  if (setter) setter.call(el, text);
  else el.value = text;

  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  try {
    el.dispatchEvent(
      new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }),
    );
  } catch {
    // ignore
  }

  const win = el.ownerDocument.defaultView as unknown as {
    jQuery?: (sel: string | Element) => { val: (v: string) => { trigger: (e: string) => void } };
    $?: (sel: string | Element) => { val: (v: string) => { trigger: (e: string) => void } };
    angular?: unknown;
  };
  const jq = win?.jQuery || win?.$;
  try {
    if (jq) {
      const chain = jq(el).val(text);
      chain.trigger("input");
      chain.trigger("change");
    }
  } catch {
    /* host page has no jQuery bridge */
  }

  el.dispatchEvent(new Event("blur", { bubbles: true }));
  // Let the host framework's change handlers settle before the caller reads back.
  await waitMs(50);
}

async function fillSelect(el: HTMLSelectElement, value: string): Promise<string> {
  return fillNativeSelect(el, value);
}

export async function fillElement(
  el: Element,
  value: string,
  fieldHint?: string | null,
): Promise<string> {
  const html = el as HTMLElement;
  html.scrollIntoView({ block: "center", behavior: "auto" });
  html.focus?.();

  if (el instanceof HTMLSelectElement) {
    const enhanced = isEnhancedSelect(el);
    const combo = findAssociatedCombobox(el);
    if (enhanced && combo && combo !== el) {
      return selectComboboxOption(combo, value, fieldHint);
    }
    return fillSelect(el, value);
  }

  if (el instanceof HTMLInputElement) {
    const type = (el.type || "text").toLowerCase();
    if (type === "checkbox" || type === "radio") {
      // Option labels ("None/Not applicable") must resolve via group matching —
      // boolean-only toggling left required checkbox groups unchecked.
      return selectRadioElement(el, value);
    }
    if (type === "password" || type === "hidden" || type === "file") {
      await setNativeValue(el, value);
      return el.value;
    }
    if (looksLikeCombobox(html)) {
      const target = resolveDropdownInteractionTarget(html);
      return selectComboboxOption(target, value, fieldHint);
    }
    await setNativeValue(el, value);
    return el.value;
  }

  if (el instanceof HTMLTextAreaElement) {
    await setNativeValue(el, value);
    return el.value;
  }

  if (html.isContentEditable) {
    html.textContent = value;
    html.dispatchEvent(new InputEvent("input", { bubbles: true, data: value }));
    return html.textContent || value;
  }

  const role = (html.getAttribute("role") || "").toLowerCase();
  if (
    el instanceof HTMLButtonElement ||
    el instanceof HTMLFieldSetElement ||
    role === "radio" ||
    role === "checkbox" ||
    role === "radiogroup" ||
    role === "group" ||
    role === "switch"
  ) {
    return selectRadioElement(el, value);
  }

  if (looksLikeCombobox(html)) {
    const target = resolveDropdownInteractionTarget(html);
    return selectComboboxOption(target, value, fieldHint);
  }

  throw new Error(`Unsupported fill target <${el.tagName.toLowerCase()}>`);
}
