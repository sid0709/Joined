import { queryAll } from "../../routineKit/extract.js";

import {
  JOB_LINK,
  MARK_HOVER_MS,
  NAVIGATE_WAIT_MS,
  PAGE_DELAY_MS,
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

function collectJobLinks(roots, pageUrl) {
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

export function jobLinksFrom(html, pageUrl, rootSelector) {
  if (!html) return [];
  const document = documentFromHtml(html);
  const roots = rootSelector ? queryAll(document, rootSelector) : [document];
  return collectJobLinks(roots, pageUrl);
}

function cardRootForJob(document, host) {
  const href = jobPathFromHref(host?.cardHref || host?.url || host?.href);
  if (!href) return null;
  for (const link of queryAll(document, JOB_LINK)) {
    if (jobPathFromHref(link.getAttribute("href") || "") !== href) continue;
    let node = link.parentElement;
    while (node) {
      const parentClass = String(node.parentElement?.getAttribute?.("class") || "");
      if (parentClass.includes("hc-card-grid")) return node;
      node = node.parentElement;
    }
    return link.parentElement;
  }
  return null;
}

export function viewAllJobLinks(html, pageUrl, host) {
  if (!html) return [];
  const document = documentFromHtml(html);
  const card = host && typeof host === "object" ? cardRootForJob(document, host) : null;
  if (card) return collectJobLinks(queryAll(card, VIEW_ALL_PANEL), pageUrl);
  const root = typeof host === "string" && host ? `${host} ${VIEW_ALL_PANEL}` : VIEW_ALL_PANEL;
  return jobLinksFrom(html, pageUrl, root);
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
  const seen = new Set();
  for (const job of jobs) seen.add(job.id);
  let host = jobs[0];
  for (const job of jobs) {
    if (job.collapseKey === collapseKey) {
      host = job;
      break;
    }
  }
  if (!host) return parsed;
  const groups = [];
  let group;
  for (const item of parsed.groups) {
    if (item.collapseKey === collapseKey) {
      group = { ...item, hits: [...item.hits] };
      groups.push(group);
    } else {
      groups.push(item);
    }
  }
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
  const hits = [];
  for (const job of jobs) hits.push(job.hit);
  attachGroups(jobs, groups.length ? groups : groupHits(hits), cards);
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
    let host;
    for (const job of next.jobs) {
      if (job.collapseKey === shortfall.collapseKey) {
        host = job;
        break;
      }
    }
    const selector = host ? jobCardSelector(host) : "";
    if (!selector) continue;
    const extras = [];
    for (let index = 1; index <= shortfall.dots; index += 1) {
      try {
        await call("click", {
          selector: `${selector} ${carouselShowSelector(index)}`,
        });
      } catch {
        /* carousel control may be absent */
      }
      await pause(rest, skipDelays, MARK_HOVER_MS);
      extras.push(...jobLinksFrom((await readPage()).html, pageUrl, selector));
    }
    const before = await readPage();
    try {
      await call("click", {
        selector: `${selector} ${VIEW_ALL_CONTROL}`,
        contains: VIEW_ALL_TEXT,
        exact: true,
      });
    } catch {
      /* View all may already be open */
    }
    await pause(rest, skipDelays, MARK_HOVER_MS);
    let after = await readPage();
    if (after.url && pageUrl && !sameUrl(after.url, pageUrl)) {
      try {
        await call("navigate", { url: pageUrl, timeout: NAVIGATE_WAIT_MS }, NAVIGATE_WAIT_MS);
      } catch {
        /* tab may already be on the list */
      }
      await pause(rest, skipDelays, PAGE_DELAY_MS.min);
      after = await readPage();
    }
    extras.push(...viewAllJobLinks(after.html, pageUrl, host));
    extras.push(...jobLinksFrom(after.html || before.html, pageUrl, selector));
    next = mergeLinksIntoGroup(next, extras, shortfall.collapseKey, pageUrl);
  }
  return next;
}
