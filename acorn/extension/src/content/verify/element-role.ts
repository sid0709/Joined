import { normalize } from "./element-labels";

export function inferRole(el: Element): string {
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

export function roleMatches(expected: string, actual: string, el: Element): boolean {
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
