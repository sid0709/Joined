import type { PureNode } from "./tree-export";

export const PAGE_TEXT_MAX_CHARS = 20_000;

const SKIP_TAGS = new Set([
  "input",
  "select",
  "textarea",
  "button",
  "option",
  "script",
  "style",
  "noscript",
]);

function collectVisibleText(node: PureNode, parts: string[]): void {
  const tag = String(node.tag || "").toLowerCase();
  if (SKIP_TAGS.has(tag)) return;
  const text = typeof node.text === "string" ? node.text.replace(/\s+/g, " ").trim() : "";
  if (text) parts.push(text);
  for (const child of node.children) collectVisibleText(child, parts);
}

/** Visible page copy from the compact analyze tree. Skips form-control chrome. */
export function extractVisiblePageText(
  pure: PureNode,
  meta?: { title?: string; url?: string },
): string {
  const parts: string[] = [];
  collectVisibleText(pure, parts);
  const body = parts
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!body) return "";

  const header = [meta?.title?.trim(), meta?.url?.trim()].filter(Boolean).join("\n");
  const combined = header ? `${header}\n\n${body}` : body;
  return combined.length > PAGE_TEXT_MAX_CHARS ? combined.slice(0, PAGE_TEXT_MAX_CHARS) : combined;
}
