function isDisplayed(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.getClientRects().length === 0) return false;
  const style = el.ownerDocument?.defaultView?.getComputedStyle(el);
  if (!style) return Boolean(el.offsetParent);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

function isFormControl(el: Element): boolean {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement
  );
}

/** When the page clones a stamped node, prefer the live form control. */
function pickAcornIdMatch(nodes: Element[]): Element | null {
  if (!nodes.length) return null;
  if (nodes.length === 1) return nodes[0];
  const controls = nodes.filter((el) => isFormControl(el) && isDisplayed(el));
  if (controls.length === 1) return controls[0];
  const displayed = nodes.filter(isDisplayed);
  if (displayed.length === 1) return displayed[0];
  return controls[0] || displayed[0] || nodes[0];
}

function collectAcornIdMatches(nodeId: number, root: Document | Element | ShadowRoot): Element[] {
  const found: Element[] = [];
  if ("querySelectorAll" in root) {
    found.push(...Array.from(root.querySelectorAll(`[data-acorn-id="${nodeId}"]`)));
  }

  const allElements = root.querySelectorAll("*");
  for (const child of Array.from(allElements)) {
    if (child.shadowRoot) {
      found.push(...collectAcornIdMatches(nodeId, child.shadowRoot));
    }
    if (child.tagName === "IFRAME") {
      try {
        const doc = (child as HTMLIFrameElement).contentDocument;
        if (doc) found.push(...collectAcornIdMatches(nodeId, doc));
      } catch {
        // CORS blocked cross-origin iframe
      }
    }
  }
  return found;
}

export function resolveElementByNodeId(
  nodeId: number,
  root: Document | Element | ShadowRoot = document,
): Element | null {
  return pickAcornIdMatch(collectAcornIdMatches(nodeId, root));
}
