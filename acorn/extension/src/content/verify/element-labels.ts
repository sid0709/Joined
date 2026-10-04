export function normalize(text: string): string {
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
export function associatedControl(el: Element): Element | null {
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

export function labelCandidates(el: Element): string[] {
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
