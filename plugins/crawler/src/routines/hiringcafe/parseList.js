import { queryAll, queryOne } from "../../routineKit/extract.js";

import {
  FIRST_PAGE_INDEX,
  HIRINGCAFE_ORIGIN,
  JOB_CARD,
  JOB_LINK,
  JOB_PATH,
  POSTED_CHIP,
} from "./constants.js";
import { documentFromHtml, resolveUrl, textOf } from "./html.js";
import { pageFromListUrl } from "./lists.js";
import { readPageProps, readSsrHits } from "./parseNextData.js";
import { asText, jobPathFromHit, requisitionIdOf } from "./values.js";

const JOB_ID_FROM_HREF = /\/job\/(?:[^/]*-)?([a-z0-9]+)$/i;

export function requisitionIdFromHref(href) {
  const path = String(href || "")
    .split("?")[0]
    .replace(/\/$/, "");
  if (!path.includes(JOB_PATH)) return "";
  return path.match(JOB_ID_FROM_HREF)?.[1] || "";
}

function groupHits(hits) {
  const groups = [];
  const index = new Map();
  for (const hit of hits) {
    const key = asText(hit?.collapse_key) || requisitionIdOf(hit) || asText(hit?.id);
    if (!key) continue;
    let group = index.get(key);
    if (!group) {
      group = { collapseKey: key, hits: [] };
      index.set(key, group);
      groups.push(group);
    }
    group.hits.push(hit);
  }
  return groups;
}

function hrefsByRequisition(document, pageUrl) {
  const found = new Map();
  for (const anchor of queryAll(document, JOB_LINK)) {
    const href = anchor.getAttribute("href") || anchor.href || "";
    const id = requisitionIdFromHref(href);
    if (!id || found.has(id)) continue;
    found.set(id, resolveUrl(href, pageUrl));
  }
  return found;
}

export function parseJobHit(hit, pageUrl, hrefs = new Map()) {
  const id = requisitionIdOf(hit);
  if (!id) return null;
  const path = jobPathFromHit(hit);
  return {
    id,
    title: asText(hit?.job_information?.title),
    url: hrefs.get(id) || resolveUrl(path, pageUrl),
    path,
    collapseKey: asText(hit?.collapse_key),
    companyName: asText(
      hit?.enriched_company_data?.name ||
        hit?.attributed_org?.name ||
        hit?.v5_processed_job_data?.company_name,
    ),
    applyUrl: asText(hit?.apply_url),
  };
}

/**
 * Every ssrHits posting on a classic list page, including grouped jobs that
 * share one card. Cards are only used to recover a live href when present.
 */
export function parseList(html, pageUrl = `${HIRINGCAFE_ORIGIN}/classic`) {
  const document = documentFromHtml(html);
  const props = readPageProps(html) ?? {};
  const hits = readSsrHits(html);
  const hrefs = hrefsByRequisition(document, pageUrl);
  const seen = new Set();
  const jobs = [];
  for (const hit of hits) {
    const parsed = parseJobHit(hit, pageUrl, hrefs);
    if (!parsed || seen.has(parsed.id)) continue;
    seen.add(parsed.id);
    jobs.push(parsed);
  }
  const groups = groupHits(hits);
  const cards = queryAll(document, JOB_CARD);
  const page =
    Number.isInteger(props.ssrPage) && props.ssrPage >= FIRST_PAGE_INDEX
      ? props.ssrPage
      : pageFromListUrl(pageUrl);
  const isLastPage = props.ssrIsLastPage === true || jobs.length === 0;
  return {
    jobs,
    groups,
    cards: cards.map((card) => ({
      href: queryOne(card, JOB_LINK)?.getAttribute("href") || "",
      postedRaw: textOf(queryOne(card, POSTED_CHIP)),
    })),
    cardCount: cards.length,
    page,
    pageSize: Number.isInteger(props.ssrPageSize) ? props.ssrPageSize : jobs.length,
    totalCount: Number.isInteger(props.ssrTotalCount) ? props.ssrTotalCount : jobs.length,
    isLastPage,
    nextPage: isLastPage ? null : page + 1,
  };
}
