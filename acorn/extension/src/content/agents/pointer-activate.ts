/** Pointer + click sequence so React/pointer handlers see an activation. */

function isDisplayed(el: HTMLElement): boolean {
  if (el.getClientRects().length === 0) return false;
  const style = el.ownerDocument?.defaultView?.getComputedStyle(el);
  if (!style) return Boolean(el.offsetParent);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

function hasClickableBox(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return rect.width > 2 && rect.height > 2 && isDisplayed(el);
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Prefer the visible label/button a person would press.
 * Hidden radios still activate via their label's default action.
 *
 * `intended` disambiguates a sibling option pair: without it the first sibling
 * wins, which silently answers "Yes" to every question the plan answered "No".
 */
export function visibleActivateTarget(el: HTMLElement, intended?: string | null): HTMLElement {
  if (el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox")) {
    if (hasClickableBox(el)) return el;
    const doc = el.ownerDocument;
    const labelled = el.id ? doc.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
    if (labelled instanceof HTMLElement && hasClickableBox(labelled)) return labelled;
    const wrap = el.closest("label");
    if (wrap instanceof HTMLElement && hasClickableBox(wrap)) return wrap;
    const siblings = Array.from(
      el.parentElement?.querySelectorAll('button, [role="button"], [role="radio"]') ?? [],
    ).filter((node): node is HTMLElement => node instanceof HTMLElement && hasClickableBox(node));
    const want = normalize(intended || "");
    const byLabel = want
      ? siblings.find((node) => normalize(node.innerText || node.textContent || "") === want)
      : undefined;
    const sibling = byLabel ?? siblings[0];
    if (sibling) return sibling;
  }
  return el;
}

export function pointerActivate(el: HTMLElement, intended?: string | null): void {
  const target = visibleActivateTarget(el, intended);
  const view = target.ownerDocument?.defaultView || window;
  const rect = target.getBoundingClientRect();
  const clientX = rect.width ? rect.left + rect.width / 2 : 0;
  const clientY = rect.height ? rect.top + rect.height / 2 : 0;
  const opts: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    view,
    clientX,
    clientY,
    button: 0,
    buttons: 1,
  };
  target.scrollIntoView({ block: "center", behavior: "auto" });
  target.focus?.();
  target.dispatchEvent(
    new PointerEvent("pointerdown", { ...opts, pointerId: 1, pointerType: "mouse" }),
  );
  target.dispatchEvent(new MouseEvent("mousedown", opts));
  target.dispatchEvent(
    new PointerEvent("pointerup", { ...opts, pointerId: 1, pointerType: "mouse" }),
  );
  target.dispatchEvent(new MouseEvent("mouseup", { ...opts, buttons: 0 }));
  // HTMLElement.click() fires `click` and runs radio/checkbox/label default actions.
  // A second dispatched click would toggle a checkbox back off.
  target.click();
}
