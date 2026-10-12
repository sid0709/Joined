import {
  BUILTIN_ORIGIN,
  COMPANY_LOGO,
  COMPANY_TITLE,
  JOB_CARD,
  JOB_CARD_TITLE,
  JOBS_PATH,
  NEXT_PAGE,
  SAVED_TAG,
  SAVED_TAG_TEXT,
} from "./constants.js";
import { documentFromHtml, resolveUrl, textOf } from "./html.js";
import { parseJobBoardInit } from "./parseInit.js";

const JOB_ID_FROM_CARD = /^job-card-(\d+)$/;
const JOB_ID_FROM_ALIAS = /\/(\d+)\/?$/;

export function jobIdFromCard(card, alias = "") {
  const fromId = String(card?.id || "").match(JOB_ID_FROM_CARD)?.[1];
  if (fromId) return fromId;
  const tracked = card
    ?.querySelector?.("[data-builtin-track-job-id]")
    ?.getAttribute?.("data-builtin-track-job-id");
  if (tracked) return String(tracked);
  return String(alias).match(JOB_ID_FROM_ALIAS)?.[1] || "";
}

/** True when Alpine has revealed the Saved tag (SSR HTML keeps both spans x-cloak). */
export function cardHasSavedTag(card) {
  const saved = card?.querySelector?.(SAVED_TAG);
  if (!saved) return false;
  if (saved.hasAttribute("x-cloak")) return false;
  return saved.textContent?.toLowerCase().includes(SAVED_TAG_TEXT.toLowerCase()) ?? false;
}

export function parseJobCard(card, pageUrl) {
  const titleLink = card.querySelector(JOB_CARD_TITLE);
  const alias = titleLink?.getAttribute("data-alias") || titleLink?.getAttribute("href") || "";
  const id = jobIdFromCard(card, alias);
  if (!id) return null;
  return {
    id: String(id),
    title: textOf(titleLink),
    url: alias ? resolveUrl(alias, pageUrl) : "",
    companyName: textOf(
      card.querySelector(`${COMPANY_TITLE} span`) || card.querySelector(COMPANY_TITLE),
    ),
    logo: card.querySelector(COMPANY_LOGO)?.getAttribute("src") || "",
    hasSavedTag: cardHasSavedTag(card),
  };
}

export function parseNextPageUrl(document, pageUrl) {
  const next = document.querySelector(NEXT_PAGE);
  const href = next?.getAttribute("href") || "";
  return href ? resolveUrl(href, pageUrl) : null;
}

/**
 * Cards and pagination for a Built In list page. Last page: no next link, or 0 cards.
 */
export function parseList(html, pageUrl = `${BUILTIN_ORIGIN}${JOBS_PATH}`) {
  const document = documentFromHtml(html);
  const seen = new Set();
  const cards = [];
  for (const card of document.querySelectorAll(JOB_CARD)) {
    const parsed = parseJobCard(card, pageUrl);
    if (!parsed || seen.has(parsed.id)) continue;
    seen.add(parsed.id);
    cards.push(parsed);
  }
  const nextPageUrl = parseNextPageUrl(document, pageUrl);
  return {
    cards,
    nextPageUrl,
    isLastPage: !nextPageUrl || cards.length === 0,
    board: parseJobBoardInit(html),
  };
}
