import { isHttpUrl } from "../../lib/httpUrl.js";
import { queryAll } from "../../routineKit/extract.js";

import { COMPANY_PROFILE_LINK } from "./constants.js";
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

/** First job-page `/company/` href, made absolute, then JSON-LD sameAs. */
export function companyProfileUrlFrom(document, org, pageUrl) {
  for (const anchor of queryAll(document, COMPANY_PROFILE_LINK)) {
    const href = resolveUrl(anchor.getAttribute("href") || anchor.href || "", pageUrl);
    if (isHttpUrl(href)) return href;
  }
  return httpUrlsOf(org?.sameAs)[0] || "";
}

function websiteFromOrg(org) {
  return httpUrlsOf(org?.url).find((url) => !isBuiltinCompanyUrl(url)) || "";
}

function websiteFromPage(scope, pageUrl, profileUrl) {
  if (!scope) return "";
  for (const anchor of queryAll(scope, "a[href]")) {
    const href = resolveUrl(anchor.getAttribute("href") || anchor.href || "", pageUrl);
    if (!isHttpUrl(href) || href === profileUrl) continue;
    if (isBuiltinCompanyUrl(href) || socialKeyFor(href)) continue;
    try {
      const parsed = new URL(href);
      if (isBuiltinHost(parsed.hostname)) continue;
    } catch {
      continue;
    }
    return href;
  }
  return "";
}

/** Company site: JSON-LD hiringOrganization.url, else a link in `scope` (company box). */
export function companyWebsiteFrom(document, org, pageUrl, profileUrl, scope) {
  const root = scope === undefined ? document : scope;
  return websiteFromOrg(org) || websiteFromPage(root, pageUrl, profileUrl);
}

export function companySocialsFrom(document, pageUrl) {
  const links = {};
  for (const anchor of queryAll(document, "a[href]")) {
    const href = resolveUrl(anchor.getAttribute("href") || anchor.href || "", pageUrl);
    if (!isHttpUrl(href)) continue;
    const key = socialKeyFor(href);
    if (key && !links[key]) links[key] = href;
  }
  return links;
}

export function companyLinkFrom(website, profileUrl) {
  return website || profileUrl || "";
}
