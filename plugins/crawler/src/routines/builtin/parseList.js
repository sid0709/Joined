import { queryAll, queryOne } from "../../routineKit/extract.js";

import {
  BUILTIN_ORIGIN,
  COMPANY_LOGO,
  COMPANY_TITLE,
  JOB_CARD,
  JOB_CARD_TITLE,
  JOBS_PATH,
  NEXT_DISABLED_ATTR,
  NEXT_DISABLED_CLASS,
  NEXT_DISABLED_VALUE,
  NEXT_PAGE,
  SAVE_HOST,
  SAVED_BADGE,
  SAVED_BADGE_TEXT,
} from "./constants.js";
import { documentFromHtml, resolveUrl, textOf } from "./html.js";
import { parseJobBoardInit } from "./parseInit.js";
import { isVisibleElement } from "./visible.js";

const JOB_ID_FROM_CARD = /^job-card-(\d+)$/;
const JOB_ID_FROM_ALIAS = /\/(\d+)\/?$/;

export function jobIdFromCard(card, alias = "") {
  const fromId = String(card?.id || "").match(JOB_ID_FROM_CARD)?.[1];
  if (fromId) return fromId;
  const tracked = queryOne(card, "[data-builtin-track-job-id]")?.getAttribute?.(
    "data-builtin-track-job-id",
  );
  if (tracked) return String(tracked);
  return String(alias).match(JOB_ID_FROM_ALIAS)?.[1] || "";
}

export function parseJobCard(card, pageUrl) {
  const titleLink = queryOne(card, JOB_CARD_TITLE);
  const alias = titleLink?.getAttribute("data-alias") || titleLink?.getAttribute("href") || "";
  const id = jobIdFromCard(card, alias);
  if (!id) return null;
  const company = queryOne(card, COMPANY_TITLE);
  const badge = queryOne(card, SAVED_BADGE);
  const badgeText = textOf(badge);
  return {
    id: String(id),
    title: textOf(titleLink),
    url: alias ? resolveUrl(alias, pageUrl) : "",
    companyName: textOf(queryOne(company, "span") || company),
    logo: queryOne(card, COMPANY_LOGO)?.getAttribute("src") || "",
    hasSaveHost: Boolean(queryOne(card, SAVE_HOST)),
    hasVisibleSavedBadge:
      Boolean(badge) &&
      new RegExp(SAVED_BADGE_TEXT, "i").test(badgeText) &&
      isVisibleElement(badge),
  };
}

export function parseNextPageUrl(document, pageUrl) {
  const next = queryOne(document, NEXT_PAGE);
  const href = next?.getAttribute("href") || "";
  return href ? resolveUrl(href, pageUrl) : null;
}

const DISABLED_CLASS_RE = new RegExp(`\\b${NEXT_DISABLED_CLASS}\\b`, "i");

/** Next is usable only when it is present and not aria-disabled / disabled. */
export function isNextPageEnabled(next) {
  if (!next) return false;
  if (next.getAttribute?.(NEXT_DISABLED_ATTR) === NEXT_DISABLED_VALUE) return false;
  if (next.hasAttribute?.("disabled")) return false;
  const className = String(next.getAttribute?.("class") || next.className || "");
  return !DISABLED_CLASS_RE.test(className);
}

/**
 * Cards and pagination for a Built In list page. Last page: Next missing or
 * disabled, or 0 cards.
 */
export function parseList(html, pageUrl = `${BUILTIN_ORIGIN}${JOBS_PATH}`) {
  const document = documentFromHtml(html);
  const seen = new Set();
  const cards = [];
  for (const card of queryAll(document, JOB_CARD)) {
    const parsed = parseJobCard(card, pageUrl);
    if (!parsed || seen.has(parsed.id)) continue;
    seen.add(parsed.id);
    cards.push(parsed);
  }
  const nextLink = queryOne(document, NEXT_PAGE);
  const nextPageUrl = parseNextPageUrl(document, pageUrl);
  const hasNextPage = isNextPageEnabled(nextLink);
  return {
    cards,
    nextPageUrl,
    hasNextPage,
    isLastPage: !hasNextPage || cards.length === 0,
    board: parseJobBoardInit(html),
  };
}
