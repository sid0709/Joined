import { isHttpUrl } from "../../lib/httpUrl.js";
import { queryAll, queryOne } from "../../routineKit/extract.js";

import { COMPANY_PROFILE_LINK, ICON_GLOBE } from "./constants.js";
import { isBuiltinHost, resolveUrl } from "./html.js";

export const SOCIAL_NETWORKS = Object.freeze([
  { key: "linkedin", hosts: Object.freeze(["linkedin.com"]) },
  { key: "x", hosts: Object.freeze(["x.com", "twitter.com"]) },
  { key: "facebook", hosts: Object.freeze(["facebook.com"]) },
  { key: "instagram", hosts: Object.freeze(["instagram.com"]) },
  { key: "github", hosts: Object.freeze(["github.com"]) },
]);

function httpUrlsOf(value) {
  const items = Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
  return items.map((item) => String(item).trim()).filter((item) => isHttpUrl(item));
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

export function isBuiltinCompanyUrl(url) {
  try {
    const parsed = new URL(url);
    return isBuiltinHost(parsed.hostname) && parsed.pathname.startsWith("/company/");
  } catch {
    return false;
  }
}

function socialKeyFor(url) {
  const host = hostnameOf(url);
  if (!host) return "";
  for (const network of SOCIAL_NETWORKS) {
    if (network.hosts.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))) {
      return network.key;
    }
  }
  return "";
}

function orgHttpUrls(org) {
  return [...httpUrlsOf(org?.url), ...httpUrlsOf(org?.sameAs)];
}

function isCompanyWebsiteUrl(url, profileUrl) {
  if (!isHttpUrl(url) || url === profileUrl || isBuiltinCompanyUrl(url) || socialKeyFor(url)) {
    return false;
  }
  try {
    return !isBuiltinHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** First job-page `/company/` href, then a JSON-LD sameAs/url that is a Built In profile. */
export function companyProfileUrlFrom(document, org, pageUrl) {
  for (const anchor of queryAll(document, COMPANY_PROFILE_LINK)) {
    const href = resolveUrl(anchor.getAttribute("href") || anchor.href || "", pageUrl);
    if (isHttpUrl(href)) return href;
  }
  return orgHttpUrls(org).find((url) => isBuiltinCompanyUrl(url)) || "";
}

function websiteFromOrg(org, profileUrl) {
  return orgHttpUrls(org).find((url) => isCompanyWebsiteUrl(url, profileUrl)) || "";
}

function hrefOf(anchor, pageUrl) {
  return resolveUrl(anchor?.getAttribute("href") || anchor?.href || "", pageUrl);
}

function websiteFromGlobe(scope, pageUrl, profileUrl) {
  const icon = queryOne(scope, ICON_GLOBE);
  if (!icon) return "";
  const row = icon.closest("div.gap-sm") || icon.parentElement || icon.closest("div");
  for (const anchor of queryAll(row || scope, "a[href]")) {
    const href = hrefOf(anchor, pageUrl);
    if (isCompanyWebsiteUrl(href, profileUrl)) return href;
  }
  return "";
}

function websiteFromPage(scope, pageUrl, profileUrl) {
  if (!scope) return "";
  const fromGlobe = websiteFromGlobe(scope, pageUrl, profileUrl);
  if (fromGlobe) return fromGlobe;
  for (const anchor of queryAll(scope, "a[href]")) {
    const href = hrefOf(anchor, pageUrl);
    if (isCompanyWebsiteUrl(href, profileUrl)) return href;
  }
  return "";
}

/**
 * Company site: JSON-LD hiringOrganization.url or sameAs when it is not a Built
 * In profile, else a website link in `scope` (The Company box).
 */
export function companyWebsiteFrom(document, org, pageUrl, profileUrl, scope) {
  const root = scope === undefined ? document : scope;
  return websiteFromOrg(org, profileUrl) || websiteFromPage(root, pageUrl, profileUrl);
}

function addSocial(links, url) {
  const key = socialKeyFor(url);
  if (key && !links[key]) links[key] = url;
}

function socialsFromScope(scope, pageUrl, links) {
  if (!scope) return;
  for (const anchor of queryAll(scope, "a[href]")) {
    addSocial(links, hrefOf(anchor, pageUrl));
  }
}

/** Social hosts from JSON-LD sameAs/url, then The Company box, then the job page. */
export function companySocialsFrom(document, org, pageUrl, scope) {
  const links = {};
  for (const url of orgHttpUrls(org)) addSocial(links, url);
  socialsFromScope(scope, pageUrl, links);
  socialsFromScope(document, pageUrl, links);
  return links;
}

/** companyLink is the employer's own website, never the Built In profile. */
export function companyLinkFrom(website) {
  return website || "";
}
