import { isHttpUrl } from "../../lib/httpUrl.js";
import { isFound } from "../../routineKit/html.js";
import { workModeFrom } from "../../routineKit/workMode.js";

import {
  BENEFIT_FLAGS,
  COMPENSATION_PERIODS,
  COMPANY_PATH,
  FAVICON_DOMAIN_PARAM,
  FAVICON_ORIGIN,
  FAVICON_PATH,
  FAVICON_SIZE,
  FAVICON_SIZE_PARAM,
  HIRINGCAFE_ORIGIN,
  JOB_PATH,
  POSTED_AT_SOURCE,
} from "./constants.js";

export { workModeFrom };

export function asText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return String(value).trim();
}

export function asStringList(value) {
  if (Array.isArray(value)) return value.map((item) => asText(item)).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/,|·/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export function asFiniteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function firstFound(...values) {
  for (const value of values) {
    if (isFound(value)) return value;
  }
  return values.at(-1);
}

export function requisitionIdOf(job) {
  return asText(job?.requisition_id || job?.requisitionId);
}

export function slugify(value) {
  return asText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function websiteUrl(value) {
  const text = asText(value);
  if (!text) return "";
  if (isHttpUrl(text)) return text;
  if (/^\/\//.test(text) && isHttpUrl(`https:${text}`)) return `https:${text}`;
  if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?:\/.*)?$/i.test(text)) return `https://${text}`;
  return "";
}

export function firstHttpOrWebsite(...values) {
  for (const value of values) {
    const url = websiteUrl(value);
    if (url) return url;
  }
  return "";
}

export function hostnameOf(url) {
  try {
    return new URL(websiteUrl(url) || url).hostname;
  } catch {
    return "";
  }
}

export function faviconUrlFor(website) {
  const host = hostnameOf(website);
  if (!host) return "";
  const url = new URL(FAVICON_PATH, FAVICON_ORIGIN);
  url.searchParams.set(FAVICON_DOMAIN_PARAM, host);
  url.searchParams.set(FAVICON_SIZE_PARAM, String(FAVICON_SIZE));
  return url.href;
}

export function isFaviconUrl(url) {
  const href = asText(url);
  if (!href) return false;
  return /s2\.googleusercontent\.com\/s2\/favicons/i.test(href) || /favicon/i.test(href);
}

export function companyLogoFrom(...candidates) {
  const urls = candidates
    .map((value) => websiteUrl(value) || (isHttpUrl(value) ? value.trim() : ""))
    .filter(Boolean);
  const preferred = urls.find((url) => !isFaviconUrl(url));
  return preferred || urls[0] || "";
}

export function companyProfileUrl(job, origin = HIRINGCAFE_ORIGIN) {
  const externalId = asText(
    job?.enriched_company_data?.external_id || job?.attributed_org?.external_id,
  );
  if (!externalId) return "";
  try {
    return new URL(`${COMPANY_PATH}${externalId}`, origin || HIRINGCAFE_ORIGIN).href;
  } catch {
    return "";
  }
}

export function jobPathFromHit(job) {
  const id = requisitionIdOf(job);
  if (!id) return "";
  const title = asText(job?.job_information?.title || job?.v5_processed_job_data?.core_job_title);
  const slug = slugify(title) || "job";
  return `${JOB_PATH}${slug}-${id}`;
}

export function isoDate(value) {
  const text = asText(value);
  if (!text) return "";
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) return /^\d{4}-\d{2}-\d{2}/.test(text) ? text : "";
  return new Date(parsed).toISOString();
}

export function postedFrom(v5, jsonLdDate, rawText) {
  const estimated = isoDate(v5?.estimated_publish_date);
  if (estimated) {
    return {
      postedAt: estimated,
      postedAgo: asText(rawText),
      postedAtSource: POSTED_AT_SOURCE.ESTIMATED_PUBLISH_DATE,
    };
  }
  const fromJsonLd = isoDate(jsonLdDate);
  if (fromJsonLd) {
    return {
      postedAt: fromJsonLd,
      postedAgo: asText(rawText),
      postedAtSource: POSTED_AT_SOURCE.JSON_LD,
    };
  }
  const raw = asText(rawText);
  return {
    postedAt: raw,
    postedAgo: raw,
    postedAtSource: raw ? POSTED_AT_SOURCE.DOM : "",
  };
}

function moneyLabel(value) {
  const n = asFiniteNumber(value);
  if (n == null) return "";
  if (Math.abs(n) >= 1000) return `$${Math.round(n / 1000)}k`;
  if (Number.isInteger(n)) return `$${n}`;
  return `$${n.toFixed(2)}`;
}

export function salaryFrom(v5) {
  const listed = asText(v5?.listed_compensation_frequency).toLowerCase();
  const periods = listed
    ? [...COMPENSATION_PERIODS.filter((item) => item.frequency === listed), ...COMPENSATION_PERIODS]
    : COMPENSATION_PERIODS;
  const seen = new Set();
  for (const period of periods) {
    if (seen.has(period.frequency)) continue;
    seen.add(period.frequency);
    const min = moneyLabel(v5?.[period.min]);
    const max = moneyLabel(v5?.[period.max]);
    if (!min && !max) continue;
    if (min && max && min !== max) return `${min}-${max}${period.suffix}`;
    return `${min || max}${period.suffix}`;
  }
  return "";
}

export function benefitsFrom(v5) {
  return BENEFIT_FLAGS.filter(([key]) => v5?.[key] === true).map(([, label]) => label);
}

export function socialLinks(job) {
  const bags = [job?.enriched_company_data, job?.attributed_org, job?.attributed_org_card];
  const links = {};
  for (const bag of bags) {
    if (!bag || typeof bag !== "object") continue;
    const found = {
      linkedin: firstHttpOrWebsite(bag.linkedin, bag.linkedin_url, bag.companyLinkedinURL),
      x: firstHttpOrWebsite(bag.twitter, bag.twitter_url, bag.x, bag.x_url),
      facebook: firstHttpOrWebsite(bag.facebook, bag.facebook_url),
      github: firstHttpOrWebsite(bag.github, bag.github_url),
    };
    for (const [key, value] of Object.entries(found)) {
      if (value && !links[key]) links[key] = value;
    }
  }
  return links;
}

export function companyNameOf(value) {
  if (typeof value === "string") {
    const text = value.trim();
    if (!text || text === "[object Object]") return "";
    return text;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return companyNameOf(value.name);
  }
  return "";
}
