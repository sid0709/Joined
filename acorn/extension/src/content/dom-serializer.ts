import type { DomNode } from "../types";

// Removed 'IFRAME' from SKIP_TAGS
export const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT"]);
const MEDIA_TAGS = new Set(["SVG", "IMG", "IMAGE", "PICTURE", "CANVAS", "VIDEO", "AUDIO"]);
const HEAD_NOISE_TAGS = new Set(["LINK", "META", "BASE", "TITLE"]);

const INTERACTIVE_TAGS = new Set([
  "A",
  "BUTTON",
  "INPUT",
  "SELECT",
  "TEXTAREA",
  "LABEL",
  "SUMMARY",
  "OPTION",
  "OPTGROUP",
  "FIELDSET",
  "FORM",
]);

// Tags that are safe to vaporize if they are empty wrappers
const FLATTENABLE_TAGS = new Set([
  "DIV",
  "SPAN",
  "SECTION",
  "MAIN",
  "ARTICLE",
  "ASIDE",
  "HEADER",
  "FOOTER",
  "NAV",
]);

const MAX_DEPTH = 32;
const MAX_CHILDREN = 120;
/**
 * Option lists are data, not layout. A country <select> runs ~195 options, so the
 * layout cap would silently drop the back half of the list and the planner would
 * never see those values. Cap option-like children far higher instead.
 */
const MAX_OPTION_CHILDREN = 600;
const MAX_TEXT = 120;

const OPTION_LIST_TAGS = new Set(["SELECT", "OPTGROUP", "DATALIST"]);

let acornIdCounter = 0;
let childCapHits = 0;
let depthCapHits = 0;
let fillableHits = 0;

function tn(el: Element): string {
  return el.tagName.toUpperCase();
}

function uniqueElements(els: Element[]): Element[] {
  const seen = new Set<Element>();
  const out: Element[] = [];
  for (const el of els) {
    if (seen.has(el)) continue;
    seen.add(el);
    out.push(el);
  }
  return out;
}

/** Light-DOM children first, then open shadow roots (hosts can have both). */
function getChildren(el: Element): Element[] {
  if (el.tagName === "IFRAME") {
    try {
      const doc = (el as HTMLIFrameElement).contentDocument;
      if (doc && doc.documentElement) return [doc.documentElement];
    } catch {
      /* cross-origin */
    }
    return [];
  }
  const light = Array.from(el.children);
  const shadow = el.shadowRoot ? Array.from(el.shadowRoot.children) : [];
  return uniqueElements([...light, ...shadow]);
}

function getChildNodes(el: Element): Node[] {
  if (el.tagName === "IFRAME") return [];
  const nodes: Node[] = [];
  if (el.shadowRoot) nodes.push(...Array.from(el.shadowRoot.childNodes));
  nodes.push(...Array.from(el.childNodes));
  return nodes;
}

export function serializeDom(root?: Element): DomNode {
  acornIdCounter = 0;
  childCapHits = 0;
  depthCapHits = 0;
  fillableHits = 0;

  // Clean up old Acorn IDs across the whole document (including iframes)
  document.querySelectorAll("[data-acorn-id]").forEach((el) => el.removeAttribute("data-acorn-id"));

  const candidates = [root, document.body, document.documentElement].filter(
    (el): el is Element => el != null,
  );

  for (const candidate of candidates) {
    const nodes = serializeNode(candidate, 0);
    if (nodes && nodes.length > 0) {
      return nodes[0];
    }
  }

  throw new Error("Root element was completely pruned");
}

function isInteractive(el: Element): boolean {
  if (INTERACTIVE_TAGS.has(tn(el))) return true;
  if (el.getAttribute("role") === "button" || el.getAttribute("role") === "link") return true;
  if (el.hasAttribute("onclick")) return true;
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  const tabIndex = el.getAttribute("tabindex");
  if (tabIndex !== null && tabIndex !== "-1") return true;
  return false;
}

function isHeadNoise(el: Element): boolean {
  if (!HEAD_NOISE_TAGS.has(tn(el))) return false;
  let parent = el.parentElement;
  while (parent) {
    if (tn(parent) === "HEAD") return true;
    if (tn(parent) === "BODY" || tn(parent) === "HTML") return false;
    parent = parent.parentElement;
  }
  return false;
}

function shouldOmitElement(el: Element): boolean {
  if (SKIP_TAGS.has(tn(el))) return true;
  if (MEDIA_TAGS.has(tn(el))) return true;
  if (isHeadNoise(el)) return true;
  return false;
}

export function getDirectText(el: Element): string | undefined {
  let text = "";
  for (const node of getChildNodes(el)) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += (node.textContent || "") + " ";
    }
  }
  text = text.replace(/\s+/g, " ").trim();
  return text.length > 0 ? text.slice(0, MAX_TEXT) : undefined;
}

function isFlattenableWrapper(el: Element): boolean {
  if (!FLATTENABLE_TAGS.has(tn(el))) return false;
  if (isInteractive(el)) return false;
  if (getDirectText(el) !== undefined) return false;

  if (el.hasAttribute("role")) return false;
  for (const attr of el.getAttributeNames()) {
    if (attr.startsWith("aria-")) return false;
  }

  return true;
}

/** <option>/<optgroup>, or an ARIA listbox entry built from generic tags. */
function isOptionLike(el: Element): boolean {
  const tag = tn(el);
  if (tag === "OPTION" || tag === "OPTGROUP") return true;
  return (el.getAttribute("role") || "").toLowerCase() === "option";
}

/** Structural signal only — no vendor class or component allowlists. */
function childCapFor(el: Element, children: Element[]): number {
  if (OPTION_LIST_TAGS.has(tn(el))) return MAX_OPTION_CHILDREN;
  if ((el.getAttribute("role") || "").toLowerCase() === "listbox") {
    return MAX_OPTION_CHILDREN;
  }
  if (children.length > MAX_CHILDREN && children.every(isOptionLike)) {
    return MAX_OPTION_CHILDREN;
  }
  return MAX_CHILDREN;
}

function serializeNode(el: Element, depth: number): DomNode[] {
  if (shouldOmitElement(el)) return [];

  const tag = el.tagName.toLowerCase();
  const flatten = isFlattenableWrapper(el);

  const rawChildEls = getChildren(el).filter((c) => !shouldOmitElement(c));
  const processedChildren: DomNode[] = [];

  const nextDepth = flatten ? depth : depth + 1;

  if (nextDepth < MAX_DEPTH) {
    const childCap = childCapFor(el, rawChildEls);
    if (rawChildEls.length > childCap) childCapHits += 1;
    for (const child of rawChildEls.slice(0, childCap)) {
      processedChildren.push(...serializeNode(child, nextDepth));
    }
  } else if (rawChildEls.length) {
    depthCapHits += 1;
  }

  if (flatten) {
    return processedChildren;
  }

  const nodeId = ++acornIdCounter;
  el.setAttribute("data-acorn-id", String(nodeId));
  const role = (el.getAttribute("role") || "").toLowerCase();
  if (
    tag === "input" ||
    tag === "select" ||
    tag === "textarea" ||
    role === "textbox" ||
    role === "combobox" ||
    role === "searchbox" ||
    role === "listbox"
  ) {
    fillableHits += 1;
  }

  const classes = el.classList?.length ? Array.from(el.classList).slice(0, 3) : undefined;
  const attrs: Record<string, string> = {};

  for (const attr of [
    "href",
    "src",
    "for",
    "type",
    "role",
    "name",
    "aria-label",
    "aria-labelledby",
    "aria-describedby",
    "aria-required",
    "aria-invalid",
    "aria-checked",
    "autocomplete",
    "placeholder",
    "value",
    "data-automation-id",
    "data-fkit-id",
    "selected",
    "checked",
  ]) {
    const val = el.getAttribute(attr);
    if (val) attrs[attr] = val.slice(0, 120);
  }

  if ((tag === "input" || tag === "textarea") && "value" in el) {
    const val = (el as HTMLInputElement).value;
    if (val) attrs["value"] = String(val).slice(0, 120);
  }

  const text = getDirectText(el);

  if (!text && processedChildren.length === 0 && !isInteractive(el) && tag !== "iframe") {
    return [];
  }

  return [
    {
      nodeId,
      tag,
      id: el.id || undefined,
      classes,
      attrs: Object.keys(attrs).length ? attrs : undefined,
      text,
      childCount: rawChildEls.length,
      children: processedChildren,
    },
  ];
}
