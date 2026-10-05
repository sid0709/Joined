import { decodeHtmlEntities, type PageElement, type PageRoot } from "./page";

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);
const RAW_TEXT_TAGS = new Set(["script", "style"]);

interface HtmlNode {
  type: "element" | "text";
  name: string;
  attrs: Record<string, string>;
  children: HtmlNode[];
  text: string;
}

function parseOpenTag(
  html: string,
  start: number,
): { name: string; attrs: Record<string, string>; selfClosing: boolean; nextIndex: number } {
  let index = start + 1;
  while (index < html.length && /\s/.test(html[index] ?? "")) {
    index += 1;
  }
  const nameStart = index;
  while (index < html.length && /[A-Za-z0-9:-]/.test(html[index] ?? "")) {
    index += 1;
  }
  const name = html.slice(nameStart, index).toLowerCase();
  const attrs: Record<string, string> = {};
  let selfClosing = VOID_TAGS.has(name);

  while (index < html.length && html[index] !== ">") {
    const char = html[index] ?? "";
    if (char === "/") {
      selfClosing = true;
      index += 1;
      continue;
    }
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    const attrStart = index;
    while (index < html.length && /[A-Za-z0-9:_-]/.test(html[index] ?? "")) {
      index += 1;
    }
    const attrName = html.slice(attrStart, index).toLowerCase();
    if (!attrName) {
      index += 1;
      continue;
    }
    while (index < html.length && /\s/.test(html[index] ?? "")) {
      index += 1;
    }
    if (html[index] === "=") {
      index += 1;
      while (index < html.length && /\s/.test(html[index] ?? "")) {
        index += 1;
      }
      const quote = html[index];
      if (quote === '"' || quote === "'") {
        index += 1;
        const end = html.indexOf(quote, index);
        attrs[attrName] = decodeHtmlEntities(html.slice(index, end === -1 ? html.length : end));
        index = end === -1 ? html.length : end + 1;
      } else {
        const valueStart = index;
        while (index < html.length && !/[\s>]/.test(html[index] ?? "")) {
          index += 1;
        }
        attrs[attrName] = decodeHtmlEntities(html.slice(valueStart, index));
      }
    } else {
      attrs[attrName] = "";
    }
  }

  if (html[index] === ">") {
    index += 1;
  }
  return { name, attrs, selfClosing, nextIndex: index };
}

function collectText(node: HtmlNode): string {
  if (node.type === "text") {
    return node.text;
  }
  return node.children.map(collectText).join("");
}

interface CompoundSelector {
  tag?: string;
  id?: string;
  classes: string[];
  attrs: { name: string; op?: "exact" | "contains"; value?: string }[];
}

export function parseCompoundSelector(token: string): CompoundSelector {
  const result: CompoundSelector = { classes: [], attrs: [] };
  let index = 0;
  if (token[0] !== "#" && token[0] !== "." && token[0] !== "[") {
    const match = /^[a-zA-Z][\w-]*/.exec(token);
    if (match) {
      result.tag = match[0].toLowerCase();
      index = match[0].length;
    }
  }
  while (index < token.length) {
    const char = token[index];
    if (char === "#") {
      const match = /^[\w-]+/.exec(token.slice(index + 1));
      result.id = match?.[0] ?? "";
      index += 1 + (match?.[0].length ?? 0);
    } else if (char === ".") {
      const match = /^[\w-]+/.exec(token.slice(index + 1));
      if (match) {
        result.classes.push(match[0]);
      }
      index += 1 + (match?.[0].length ?? 0);
    } else if (char === "[") {
      const end = token.indexOf("]", index);
      const body = token.slice(index + 1, end === -1 ? token.length : end);
      index = end === -1 ? token.length : end + 1;
      const contains = /^([\w-]+)\*=["']?([^"']*)["']?$/.exec(body);
      const exact = /^([\w-]+)=["']?([^"']*)["']?$/.exec(body);
      if (contains) {
        result.attrs.push({ name: contains[1].toLowerCase(), op: "contains", value: contains[2] });
      } else if (exact) {
        result.attrs.push({ name: exact[1].toLowerCase(), op: "exact", value: exact[2] });
      } else {
        result.attrs.push({ name: body.toLowerCase() });
      }
    } else {
      index += 1;
    }
  }
  return result;
}

function classList(node: HtmlNode): string[] {
  return (node.attrs.class ?? "").split(/\s+/).filter(Boolean);
}

function matchesCompound(node: HtmlNode, selector: CompoundSelector): boolean {
  if (node.type !== "element") {
    return false;
  }
  if (selector.tag && node.name !== selector.tag) {
    return false;
  }
  if (selector.id && node.attrs.id !== selector.id) {
    return false;
  }
  const classes = classList(node);
  if (selector.classes.some((name) => !classes.includes(name))) {
    return false;
  }
  for (const attr of selector.attrs) {
    const value = node.attrs[attr.name];
    if (value === undefined) {
      return false;
    }
    if (attr.op === "exact" && value !== attr.value) {
      return false;
    }
    if (attr.op === "contains" && !value.includes(attr.value ?? "")) {
      return false;
    }
  }
  return true;
}

function elementDescendants(node: HtmlNode): HtmlNode[] {
  const found: HtmlNode[] = [];
  const walk = (current: HtmlNode) => {
    for (const child of current.children) {
      if (child.type === "element") {
        found.push(child);
        walk(child);
      }
    }
  };
  walk(node);
  return found;
}

function queryDescendants(root: HtmlNode, selector: string): HtmlNode[] {
  const parts = selector.trim().split(/\s+/).filter(Boolean).map(parseCompoundSelector);
  if (parts.length === 0) {
    return [];
  }
  let current = elementDescendants(root).filter((node) => matchesCompound(node, parts[0]));
  for (const part of parts.slice(1)) {
    const next: HtmlNode[] = [];
    for (const node of current) {
      for (const descendant of elementDescendants(node)) {
        if (matchesCompound(descendant, part) && !next.includes(descendant)) {
          next.push(descendant);
        }
      }
    }
    current = next;
  }
  return current;
}

class HtmlElementView implements PageElement {
  constructor(private readonly node: HtmlNode) {}

  get textContent(): string {
    return collectText(this.node);
  }

  getAttribute(name: string): string | null {
    const value = this.node.attrs[name.toLowerCase()];
    return value === undefined ? null : value;
  }

  querySelector(selector: string): PageElement | null {
    const match = queryDescendants(this.node, selector)[0];
    return match ? new HtmlElementView(match) : null;
  }

  querySelectorAll(selector: string): PageElement[] {
    return queryDescendants(this.node, selector).map((node) => new HtmlElementView(node));
  }
}

class HtmlDocumentView implements PageRoot {
  constructor(private readonly root: HtmlNode) {}

  querySelector(selector: string): PageElement | null {
    const match = queryDescendants(this.root, selector)[0];
    return match ? new HtmlElementView(match) : null;
  }

  querySelectorAll(selector: string): PageElement[] {
    return queryDescendants(this.root, selector).map((node) => new HtmlElementView(node));
  }
}

export function parseHtmlTree(html: string): HtmlNode {
  const root: HtmlNode = { type: "element", name: "#document", attrs: {}, children: [], text: "" };
  const stack = [root];
  let index = 0;

  const current = () => stack[stack.length - 1] ?? root;

  while (index < html.length) {
    if (html.startsWith("<!--", index)) {
      const end = html.indexOf("-->", index + 4);
      index = end === -1 ? html.length : end + 3;
      continue;
    }
    if (html.startsWith("<!DOCTYPE", index) || html.startsWith("<!doctype", index)) {
      const end = html.indexOf(">", index);
      index = end === -1 ? html.length : end + 1;
      continue;
    }
    if (html[index] === "<") {
      if (html[index + 1] === "/") {
        const end = html.indexOf(">", index);
        const name = html
          .slice(index + 2, end === -1 ? html.length : end)
          .trim()
          .toLowerCase();
        index = end === -1 ? html.length : end + 1;
        for (let depth = stack.length - 1; depth > 0; depth -= 1) {
          if (stack[depth]?.name === name) {
            stack.length = depth;
            break;
          }
        }
        continue;
      }
      const opened = parseOpenTag(html, index);
      index = opened.nextIndex;
      const element: HtmlNode = {
        type: "element",
        name: opened.name,
        attrs: opened.attrs,
        children: [],
        text: "",
      };
      current().children.push(element);
      if (RAW_TEXT_TAGS.has(opened.name) && !opened.selfClosing) {
        const closeToken = `</${opened.name}`;
        const closeAt = html.toLowerCase().indexOf(closeToken, index);
        const raw = closeAt === -1 ? html.slice(index) : html.slice(index, closeAt);
        element.children.push({
          type: "text",
          name: "#text",
          attrs: {},
          children: [],
          text: decodeHtmlEntities(raw),
        });
        index = closeAt === -1 ? html.length : html.indexOf(">", closeAt) + 1;
        continue;
      }
      if (!opened.selfClosing) {
        stack.push(element);
      }
      continue;
    }
    const nextTag = html.indexOf("<", index);
    const text = nextTag === -1 ? html.slice(index) : html.slice(index, nextTag);
    index = nextTag === -1 ? html.length : nextTag;
    if (text.length > 0) {
      current().children.push({
        type: "text",
        name: "#text",
        attrs: {},
        children: [],
        text: decodeHtmlEntities(text),
      });
    }
  }

  return root;
}

export function parseHtmlDocument(html: string): PageRoot {
  return new HtmlDocumentView(parseHtmlTree(html));
}
