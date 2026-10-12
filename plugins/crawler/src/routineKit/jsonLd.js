import { documentFromHtml } from "./html.js";

/** JSON-LD scripts, including HTML-escaped `ld+json` types. */
export const JSON_LD_SCRIPT = 'script[type*="ld"]';

function walkGraph(node, found) {
  if (!node || typeof node !== "object") return;
  const type = node["@type"];
  const types = Array.isArray(type) ? type : type ? [type] : [];
  if (types.includes("JobPosting")) found.push(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value) || (value && typeof value === "object")) walkGraph(value, found);
  }
}

/** JobPosting objects from JSON-LD. */
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
