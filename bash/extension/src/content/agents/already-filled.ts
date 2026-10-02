import { choiceOptionLabel, findVisibleChoiceOption, isProxyControl } from "./choice-group";
import { isChoiceSelected, isChoiceWidget } from "./choice-state";
import { readControlValue } from "./read-control-value";

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeLoose(text: string): string {
  return normalize(text)
    .replace(/[^\p{L}\p{N}+]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function optionOwnLabel(el: Element): string {
  const html = el as HTMLElement;
  return (
    html.getAttribute("aria-label") ||
    html.getAttribute("title") ||
    (el instanceof HTMLOptionElement ? el.label || el.text : "") ||
    html.innerText ||
    html.textContent ||
    ""
  )
    .replace(/\s+/g, " ")
    .trim();
}

function isSelectedOption(el: Element): boolean {
  if (el instanceof HTMLOptionElement) return el.selected;
  const html = el as HTMLElement;
  if (html.getAttribute("aria-selected") === "true") return true;
  if (html.getAttribute("aria-checked") === "true") return true;
  if (html.classList.contains("selected") || html.classList.contains("is-selected")) {
    return true;
  }
  return false;
}

/**
 * Result shape for every `controlAlreadyMatches` branch. The leading id/branch
 * and trailing intended/el args are kept so each call site still documents which
 * branch produced the verdict; only `matched` and `current` are returned.
 */
function verdict(
  _hypothesisId: string,
  _branch: string,
  matched: boolean,
  current: string,
  _intended: string,
  _el: Element,
): { matched: boolean; current: string } {
  return { matched, current };
}

/** True when the live control already shows the intended answer (autofill / prior fill). */
export function controlAlreadyMatches(
  el: Element,
  intended: string | null | undefined,
  opts?: { fileName?: string | null },
): { matched: boolean; current: string } {
  if (intended == null || !String(intended).trim()) {
    return verdict("A", "empty-intended", false, readControlValue(el), String(intended ?? ""), el);
  }

  const intendedStr = String(intended);
  const role = ((el as HTMLElement).getAttribute?.("role") || "").toLowerCase();
  // role=option always "contains" its own label — only count as filled when selected.
  if (role === "option" || el instanceof HTMLOptionElement) {
    const label = optionOwnLabel(el);
    const want = normalize(intendedStr);
    const have = normalize(label);
    const labelMatches =
      Boolean(have) && (have === want || have.includes(want) || want.includes(have));
    const selected = isSelectedOption(el);
    return verdict(
      "E",
      selected && labelMatches ? "option-selected" : "option-unselected",
      selected && labelMatches,
      selected ? label : "",
      intendedStr,
      el,
    );
  }

  const current = readControlValue(el);

  if (el instanceof HTMLInputElement && el.type === "file") {
    if (!current) {
      return verdict("A", "file-empty", false, current, intendedStr, el);
    }
    const want = opts?.fileName?.trim();
    if (!want) {
      return verdict("A", "file-any", true, current, intendedStr, el);
    }
    const matched =
      normalize(current) === normalize(want) || normalize(current).includes(normalize(want));
    return verdict("A", "file-name", matched, current, intendedStr, el);
  }

  if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
    const booleanLike = /^(true|yes|1|on|checked|false|no|0|off|unchecked)$/i.test(
      intendedStr.trim(),
    );
    // Radios: Yes/No is the option to select, not checked/unchecked.
    // Checkboxes: Yes/No means the box should be on/off.
    if (booleanLike && el.type === "checkbox") {
      // A checkbox nobody can see is a proxy for a visible option pair, and an
      // unchecked proxy means "unanswered", not "answered no". Read the visible
      // option instead, or the negative answer looks satisfied and is skipped.
      const option = isProxyControl(el) ? findVisibleChoiceOption(el, intendedStr) : null;
      if (option) {
        const selected = isChoiceSelected(option);
        return verdict(
          "D",
          selected ? "proxy-choice-selected" : "proxy-choice-unselected",
          selected,
          selected ? choiceOptionLabel(option) : "",
          intendedStr,
          el,
        );
      }
      const wantChecked = /^(true|yes|1|on|checked)$/i.test(intendedStr.trim());
      return verdict(
        "D",
        "native-bool",
        el.checked === wantChecked,
        String(el.checked),
        intendedStr,
        el,
      );
    }
    const id = el.id;
    const byFor =
      id && el.ownerDocument
        ? el.ownerDocument.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent
        : null;
    const label = normalize(
      (el.getAttribute("aria-label") || byFor || el.closest("label")?.textContent || el.value || "")
        .replace(/\s+/g, " ")
        .trim(),
    );
    const want = normalize(intendedStr);
    const labelMatches = Boolean(
      label && (label === want || label.includes(want) || want.includes(label)),
    );
    return verdict(
      "D",
      "native-label",
      labelMatches && el.checked,
      el.checked ? label || String(el.checked) : "",
      intendedStr,
      el,
    );
  }

  if (isChoiceWidget(el)) {
    const selected = isChoiceSelected(el);
    const label = optionOwnLabel(el);
    const want = normalize(intendedStr);
    const have = normalize(label);
    const labelMatches =
      Boolean(have) && (have === want || have.includes(want) || want.includes(have));
    return verdict(
      "B",
      selected && labelMatches ? "choice-selected" : "choice-unselected",
      Boolean(selected && labelMatches),
      selected ? label : "",
      intendedStr,
      el,
    );
  }

  const want = normalize(intendedStr);
  const have = normalize(current);
  if (!have) {
    return verdict("A", "generic-empty", false, current, intendedStr, el);
  }
  if (have === want) {
    return verdict("B", "generic-exact", true, current, intendedStr, el);
  }

  const wantLoose = normalizeLoose(intendedStr);
  const haveLoose = normalizeLoose(current);
  if (wantLoose && haveLoose && wantLoose === haveLoose) {
    return verdict("B", "generic-loose", true, current, intendedStr, el);
  }

  if (want.length >= 2 && (have.startsWith(want) || want.startsWith(have))) {
    return verdict("C", "generic-prefix", true, current, intendedStr, el);
  }

  return verdict("A", "generic-no-match", false, current, intendedStr, el);
}
