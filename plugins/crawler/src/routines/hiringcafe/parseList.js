import { queryAll, queryOne } from "../../routineKit/extract.js";

import {
  FIRST_PAGE_INDEX,
  HIRINGCAFE_ORIGIN,
  JOB_CARD,
  JOB_LINK,
  POSTED_CHIP,
  jobPathFromHref,
  requisitionIdFromHref,
} from "./constants.js";
import { documentFromHtml, resolveUrl, textOf } from "./html.js";
import { pageFromListUrl } from "./lists.js";
import { readPageProps, readSsrHits } from "./parseNextData.js";
import { asText, jobPathFromHit, requisitionIdOf } from "./values.js";

export { requisitionIdFromHref };

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
  const posted = new Map();
  for (const card of queryAll(document, JOB_CARD)) {
    const href = queryOne(card, JOB_LINK)?.getAttribute("href") || "";
    const id = requisitionIdFromHref(href);
    if (!id || found.has(id)) continue;
    found.set(id, resolveUrl(href, pageUrl));
    posted.set(id, textOf(queryOne(card, POSTED_CHIP)));
  }
  return { hrefs: found, posted };
}

export function parseJobHit(hit, pageUrl, cards = { hrefs: new Map(), posted: new Map() }) {
  const id = requisitionIdOf(hit);
  if (!id) return null;
  const liveHref = cards.hrefs.get(id) || "";
  const livePath = jobPathFromHref(liveHref);
  const path = livePath || jobPathFromHit(hit);
  return {
    id,
    title: asText(hit?.job_information?.title),
    url: liveHref || resolveUrl(path, pageUrl),
    path,
    cardHref: liveHref,
    collapseKey: asText(hit?.collapse_key),
    companyName: asText(
      hit?.enriched_company_data?.name ||
        hit?.attributed_org?.name ||
        hit?.v5_processed_job_data?.company_name,
    ),
    applyUrl: asText(hit?.apply_url),
    postedRaw: cards.posted.get(id) || "",
    cardJobId: liveHref ? id : "",
    groupIds: [],
    groupIndex: 1,
    groupSize: 1,
    hit,
  };
}

function attachGroups(jobs, groups, cards) {
  const byKey = new Map(groups.map((group) => [group.collapseKey, group]));
  const cardByGroup = new Map();
  for (const job of jobs) {
    if (job.cardJobId && job.collapseKey && !cardByGroup.has(job.collapseKey)) {
      cardByGroup.set(job.collapseKey, job.cardJobId);
    }
  }
  for (const job of jobs) {
    const group = byKey.get(job.collapseKey);
    const ids = (group?.hits ?? []).map((hit) => requisitionIdOf(hit)).filter(Boolean);
    job.groupIds = ids;
    job.groupIndex = Math.max(1, ids.indexOf(job.id) + 1);
    job.groupSize = ids.length || 1;
    if (!job.cardJobId) {
      job.cardJobId = job.collapseKey ? cardByGroup.get(job.collapseKey) || "" : "";
    }
    if (!job.cardHref && job.cardJobId) {
      job.cardHref = cards.hrefs.get(job.cardJobId) || "";
    }
    if (!job.postedRaw && job.cardJobId) {
      job.postedRaw = cards.posted.get(job.cardJobId) || "";
    }
    job.groupPaths = (group?.hits ?? [])
      .map((item) => {
        const itemId = requisitionIdOf(item);
        return jobPathFromHref(cards.hrefs.get(itemId)) || jobPathFromHit(item);
      })
      .filter(Boolean);
  }
  return jobs;
}

/**
 * Every ssrHits posting on a classic list page, including grouped jobs that
 * share one card. Cards recover a live href and the group's carousel order.
 */
export function parseList(html, pageUrl = `${HIRINGCAFE_ORIGIN}/classic`) {
  const document = documentFromHtml(html);
  const props = readPageProps(html) ?? {};
  const hits = readSsrHits(html);
  const cards = hrefsByRequisition(document, pageUrl);
  const seen = new Set();
  const jobs = [];
  for (const hit of hits) {
    const parsed = parseJobHit(hit, pageUrl, cards);
    if (!parsed || seen.has(parsed.id)) continue;
    seen.add(parsed.id);
    jobs.push(parsed);
  }
  const groups = groupHits(hits);
  attachGroups(jobs, groups, cards);
  const cardNodes = queryAll(document, JOB_CARD);
  const page =
    Number.isInteger(props.ssrPage) && props.ssrPage >= FIRST_PAGE_INDEX
      ? props.ssrPage
      : pageFromListUrl(pageUrl);
  const isLastPage = props.ssrIsLastPage === true;
  return {
    jobs,
    groups,
    cards: cardNodes.map((card) => ({
      href: queryOne(card, JOB_LINK)?.getAttribute("href") || "",
      postedRaw: textOf(queryOne(card, POSTED_CHIP)),
    })),
    cardCount: cardNodes.length,
    page,
    pageSize: Number.isInteger(props.ssrPageSize) ? props.ssrPageSize : jobs.length,
    totalCount: Number.isInteger(props.ssrTotalCount) ? props.ssrTotalCount : jobs.length,
    signedIn: props.ssrSignedIn === true,
    isLastPage,
    nextPage: isLastPage ? null : page + 1,
  };
}
