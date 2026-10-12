import { queryAll } from "../../routineKit/extract.js";

import {
  JOB_LINK,
  JOB_PATH,
  MARK_HOVER_MS,
  NAVIGATE_WAIT_MS,
  VIEW_ALL_CONTROL,
  VIEW_ALL_PANEL,
  VIEW_ALL_TEXT,
  carouselShowSelector,
  jobCardSelector,
  jobPathFromHref,
  requisitionIdFromHref,
} from "./constants.js";
import { documentFromHtml, resolveUrl, textOf } from "./html.js";
import { sameUrl } from "./page.js";
import { attachGroups, groupHits, groupShortfalls, parseJobHit } from "./parseList.js";
import { asText } from "./values.js";

function hrefRecord(href, pageUrl, title = "") {
  const id = requisitionIdFromHref(href);
  if (!id) return null;
  return { id, url: resolveUrl(href, pageUrl), title: asText(title), href };
}

export function jobLinksFrom(html, pageUrl, rootSelector) {
  if (!html) return [];
  const document = documentFromHtml(html);
  const roots = rootSelector ? queryAll(document, rootSelector) : [document];
  const seen = new Set();
  const found = [];
  for (const root of roots) {
    for (const link of queryAll(root, JOB_LINK)) {
      const record = hrefRecord(link.getAttribute("href") || "", pageUrl, textOf(link));
      if (!record || seen.has(record.id)) continue;
      seen.add(record.id);
      found.push(record);
    }
  }
  return found;
}

export function viewAllJobLinks(html, pageUrl) {
  return jobLinksFrom(html, pageUrl, VIEW_ALL_PANEL);
}

function jobFromLink(extra, host, pageUrl) {
  const hit = {
    requisition_id: extra.id,
    collapse_key: host.collapseKey,
    job_information: { title: extra.title },
  };
  const parsed = parseJobHit(hit, pageUrl, {
    hrefs: new Map([[extra.id, extra.url]]),
    posted: new Map(),
  });
  if (!parsed) {
    return {
      id: extra.id,
      title: extra.title,
      url: extra.url,
      path: jobPathFromHref(extra.url) || `${JOB_PATH}${extra.id}`,
      cardHref: host.cardHref || extra.url,
      collapseKey: host.collapseKey,
      companyName: host.companyName,
      applyUrl: "",
      postedRaw: host.postedRaw || "",
      cardJobId: host.cardJobId,
      cardDots: host.cardDots,
      groupIds: [],
      groupIndex: 1,
      groupSize: 1,
      hit,
    };
  }
  parsed.cardHref = parsed.cardHref || host.cardHref;
  parsed.cardJobId = parsed.cardJobId || host.cardJobId;
  parsed.cardDots = host.cardDots || parsed.cardDots;
  parsed.companyName = parsed.companyName || host.companyName;
  parsed.postedRaw = parsed.postedRaw || host.postedRaw;
  return parsed;
}

function mergeLinksIntoGroup(parsed, extras, collapseKey, pageUrl) {
  if (!extras.length) return parsed;
  const jobs = [...parsed.jobs];
  const seen = new Set(jobs.map((job) => job.id));
  const host = jobs.find((job) => job.collapseKey === collapseKey) || jobs[0];
  if (!host) return parsed;
  const groups = parsed.groups.map((group) =>
    group.collapseKey === collapseKey ? { ...group, hits: [...group.hits] } : group,
  );
  const group = groups.find((item) => item.collapseKey === collapseKey);
  let added = false;
  for (const extra of extras) {
    if (!extra?.id || seen.has(extra.id)) continue;
    seen.add(extra.id);
    added = true;
    const job = jobFromLink(extra, host, pageUrl);
    jobs.push(job);
    group?.hits.push(job.hit);
  }
  if (!added) return parsed;
  const cards = parsed.cardsMeta ?? { hrefs: new Map(), posted: new Map(), dots: new Map() };
  attachGroups(jobs, groups.length ? groups : groupHits(jobs.map((job) => job.hit)), cards);
  return { ...parsed, jobs, groups, shortfalls: groupShortfalls(jobs, groups) };
}

async function pause(rest, skipDelays, ms) {
  if (!skipDelays && typeof rest === "function") await rest(ms);
}

/**
 * When a card shows more dots than ssrHits captured, click Show job N and
 * View all, then fold every extra /job/ href into that collapse_key group.
 */
export async function expandShortGroups({
  parsed,
  call,
  rest,
  skipDelays = false,
  readPage,
  pageUrl,
} = {}) {
  if (!parsed?.shortfalls?.length || typeof call !== "function" || typeof readPage !== "function") {
    return parsed;
  }
  let next = parsed;
  for (const shortfall of parsed.shortfalls) {
    const host = next.jobs.find((job) => job.collapseKey === shortfall.collapseKey);
    const selector = host ? jobCardSelector(host) : "";
    if (!selector) continue;
    const extras = [];
    for (let index = 1; index <= shortfall.dots; index += 1) {
      await call("click", {
        selector: `${selector} ${carouselShowSelector(index)}`,
      }).catch(() => {});
      await pause(rest, skipDelays, MARK_HOVER_MS);
      extras.push(...jobLinksFrom((await readPage()).html, pageUrl, selector));
    }
    const before = await readPage();
    await call("click", {
      selector: `${selector} ${VIEW_ALL_CONTROL}`,
      contains: VIEW_ALL_TEXT,
      exact: true,
    }).catch(() => {});
    await pause(rest, skipDelays, MARK_HOVER_MS);
    let after = await readPage();
    if (after.url && pageUrl && !sameUrl(after.url, pageUrl)) {
      await call("navigate", { url: pageUrl, timeout: NAVIGATE_WAIT_MS }, NAVIGATE_WAIT_MS).catch(
        () => {},
      );
      after = await readPage();
    }
    extras.push(...viewAllJobLinks(after.html, pageUrl));
    extras.push(...jobLinksFrom(after.html || before.html, pageUrl, selector));
    next = mergeLinksIntoGroup(next, extras, shortfall.collapseKey, pageUrl);
  }
  return next;
}
