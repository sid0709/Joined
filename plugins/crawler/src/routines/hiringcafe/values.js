import { isHttpUrl } from "../../lib/httpUrl.js";
import { isFound } from "../../routineKit/html.js";
import { workModeFrom } from "../../routineKit/workMode.js";

import { BENEFIT_FLAGS, COMPENSATION_PERIODS, JOB_PATH, POSTED_AT_SOURCE } from "./constants.js";

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

export function isFaviconUrl(url) {
  const href = asText(url);
  if (!href) return false;
  return /s2\.googleusercontent\.com\/s2\/favicons/i.test(href) || /favicon/i.test(href);
}

/** First HTTP URL HiringCafe itself provided. Prefer a real logo over a favicon they rendered. */
export function companyLogoFrom(...candidates) {
  const urls = candidates
    .map((value) => websiteUrl(value) || (isHttpUrl(value) ? value.trim() : ""))
    .filter(Boolean);
  const preferred = urls.find((url) => !isFaviconUrl(url));
  return preferred || urls[0] || "";
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

/** Own keys HiringCafe put on a job / hit object. Absent keys stay absent. */
export function providedJobSource(job) {
  const source = {};
  if (!job || typeof job !== "object") return source;
  for (const [key, value] of Object.entries(job)) {
    if (value == null || value === "") continue;
    source[key] = value;
  }
  return source;
}

export function assignProvided(record, key, value) {
  if (!isFound(value)) return;
  record[key] = value;
}

export function objectBag(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
