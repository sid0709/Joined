import { queryAll, queryOne } from "../../routineKit/extract.js";

import {
  CARD_DOT,
  FIRST_PAGE_INDEX,
  HIRINGCAFE_ORIGIN,
  JOB_CARD,
  JOB_LINK,
  JOB_PATH,
  POSTED_CHIP,
  VIEW_ALL_PANEL,
  groupShortfallLabel,
  jobPathFromHref,
  requisitionIdFromHref,
} from "./constants.js";
import { documentFromHtml, resolveUrl, textOf } from "./html.js";
import { pageFromListUrl } from "./lists.js";
import { readPageProps, readSsrHits } from "./parseNextData.js";
import { asText, jobPathFromHit, requisitionIdOf } from "./values.js";

export { requisitionIdFromHref };

export function groupHits(hits) {
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
  const dots = new Map();
  const extras = [];
  for (const card of queryAll(document, JOB_CARD)) {
    const cardDots = queryAll(card, CARD_DOT).length;
    let primaryId = "";
    for (const link of queryAll(card, JOB_LINK)) {
      const href = link.getAttribute("href") || "";
      const id = requisitionIdFromHref(href);
      if (!id) continue;
      const url = resolveUrl(href, pageUrl);
      extras.push({ id, url });
      if (!primaryId) primaryId = id;
      if (!found.has(id)) {
        found.set(id, url);
        posted.set(id, textOf(queryOne(card, POSTED_CHIP)));
      }
    }
    if (primaryId && cardDots) dots.set(primaryId, cardDots);
  }
  return { hrefs: found, posted, dots, extras };
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

export function attachGroups(jobs, groups, cards) {
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
    job.cardDots = cards.dots?.get(job.cardJobId) || cards.dots?.get(job.id) || 0;
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
  for (const extra of [
    ...(hits.length ? (cards.extras ?? []) : []),
    ...viewAllExtras(document, pageUrl),
  ]) {
    if (!extra.id || seen.has(extra.id)) continue;
    seen.add(extra.id);
    jobs.push({
      id: extra.id,
      title: extra.title || "",
      url: extra.url,
      path: jobPathFromHref(extra.url) || `${JOB_PATH}${extra.id}`,
      cardHref: extra.url,
      collapseKey: "",
      companyName: "",
      applyUrl: "",
      postedRaw: cards.posted.get(extra.id) || "",
      cardJobId: extra.id,
      cardDots: cards.dots?.get(extra.id) || 0,
      groupIds: [extra.id],
      groupIndex: 1,
      groupSize: 1,
      groupPaths: [jobPathFromHref(extra.url)],
      hit: { requisition_id: extra.id },
    });
  }
  const groups = groupHits([
    ...hits,
    ...jobs
      .filter((job) => !hits.some((hit) => requisitionIdOf(hit) === job.id))
      .map((job) => job.hit),
  ]);
  attachGroups(jobs, groups, cards);
  assignShortGroupKeys(jobs, groups);
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
    shortfalls: groupShortfalls(jobs, groups),
    cardsMeta: cards,
  };
}

function viewAllExtras(document, pageUrl) {
  const extras = [];
  const seen = new Set();
  for (const panel of queryAll(document, VIEW_ALL_PANEL)) {
    for (const link of queryAll(panel, JOB_LINK)) {
      const href = link.getAttribute("href") || "";
      const id = requisitionIdFromHref(href);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      extras.push({ id, url: resolveUrl(href, pageUrl), title: textOf(link) });
    }
  }
  return extras;
}

function assignShortGroupKeys(jobs, groups) {
  const short = (groups ?? []).filter((group) => {
    const members = jobs.filter((job) => job.collapseKey === group.collapseKey);
    const dots = members.find((job) => job.cardDots)?.cardDots || 0;
    return dots > members.length;
  });
  if (short.length !== 1) return;
  const host = jobs.find((job) => job.collapseKey === short[0].collapseKey);
  if (!host) return;
  for (const job of jobs) {
    if (job.collapseKey) continue;
    job.collapseKey = host.collapseKey;
    if (job.hit && typeof job.hit === "object") job.hit.collapse_key = host.collapseKey;
    if (!job.cardJobId) job.cardJobId = host.cardJobId;
    if (!job.cardHref) job.cardHref = host.cardHref;
    job.cardDots = job.cardDots || host.cardDots;
  }
  attachGroups(jobs, groupHits(jobs.map((job) => job.hit)), {
    hrefs: new Map(jobs.map((job) => [job.id, job.url])),
    posted: new Map(),
    dots: new Map(jobs.filter((job) => job.cardJobId).map((job) => [job.cardJobId, job.cardDots])),
  });
}

export function groupShortfalls(jobs, groups) {
  const warnings = [];
  for (const group of groups ?? []) {
    const members = (jobs ?? []).filter((job) => job.collapseKey === group.collapseKey);
    const captured = members.length || group.hits?.length || 0;
    const dots = members.find((job) => job.cardDots)?.cardDots || 0;
    if (dots > captured) {
      warnings.push({
        collapseKey: group.collapseKey,
        captured,
        dots,
        label: groupShortfallLabel(group.collapseKey, captured, dots),
      });
    }
  }
  return warnings;
}
