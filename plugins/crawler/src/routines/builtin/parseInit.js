import { JOB_BOARD_INIT_NAME, JOB_POST_INIT_NAME, JSON_LD_SCRIPT } from "./constants.js";
import { documentFromHtml } from "./html.js";

/**
 * Slice the JSON argument of `Name({...})` out of a script, respecting strings
 * so a `});` inside a value does not end the call early.
 */
export function extractCallPayload(source, fnName) {
  const text = String(source ?? "");
  const needle = `${fnName}(`;
  const start = text.indexOf(needle);
  if (start < 0) return null;
  let index = start + needle.length;
  while (index < text.length && text[index] !== "{" && text[index] !== "[") index += 1;
  if (index >= text.length) return null;
  const open = text[index];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let quote = "";
  let escaped = false;
  for (let cursor = index; cursor < text.length; cursor += 1) {
    const char = text[cursor];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) inString = false;
      continue;
    }
    if (char === '"' || char === "'") {
      inString = true;
      quote = char;
      continue;
    }
    if (char === open) depth += 1;
    else if (char === close) {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(index, cursor + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export function parseJobPostInit(html) {
  return extractCallPayload(html, JOB_POST_INIT_NAME);
}

export function parseJobBoardInit(html) {
  return extractCallPayload(html, JOB_BOARD_INIT_NAME);
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function walkGraph(node, found) {
  if (!node || typeof node !== "object") return;
  if (node["@type"] === "JobPosting") found.push(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value) || (value && typeof value === "object")) walkGraph(value, found);
  }
}

/** JobPosting objects from JSON-LD, matching escaped (`ld&#x2B;json`) and plain types. */
export function parseJobPostingJsonLd(html) {
  const document = documentFromHtml(html);
  const postings = [];
  for (const script of document.querySelectorAll(JSON_LD_SCRIPT)) {
    const type = script.getAttribute("type") || "";
    if (!/ld/i.test(type) || !/json/i.test(type)) continue;
    let data;
    try {
      data = JSON.parse(script.textContent || "");
    } catch {
      continue;
    }
    walkGraph(data, postings);
  }
  return postings[0] ?? null;
}
