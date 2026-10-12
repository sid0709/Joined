import { isHttpUrl } from "../../lib/httpUrl.js";
import { queryAll, queryOne } from "../../routineKit/extract.js";
import { firstElementByText, isFound } from "../../routineKit/html.js";
import { workModeFrom } from "../../routineKit/workMode.js";

import { resolveApplyUrl } from "./applyUrl.js";
import { companyProfileUrlFrom, companySocialsFrom, companyWebsiteFrom } from "./companyLinks.js";
import {
  APPLY_FORM,
  APPLY_UNAUTH,
  COMPANY_PROFILE_LINK,
  EASY_APPLY_TAG,
  HEADER_SCOPE,
  ICON_EMPLOYEES,
  ICON_FOUNDED,
  ICON_HQ,
  ICON_LOCATION,
  ICON_POSTED,
  ICON_SALARY,
  ICON_SENIORITY,
  ICON_WORKPLACE,
  JOB_BODY,
  JOB_BODY_ID_PREFIX,
  JOB_POST_ITEM,
  TITLE_HEADING,
} from "./constants.js";
import { documentFromHtml, htmlToPlainText, resolveUrl, textOf } from "./html.js";
import { parseJobPostingJsonLd, parseJobPostInit } from "./parseInit.js";
import { postedAgoText, resolvePostedAt } from "./postedAgo.js";

function headerRoot(document) {
  return queryOne(document, HEADER_SCOPE) || queryOne(document, JOB_POST_ITEM) || document;
}

function rowByIcon(scope, iconSelector) {
  const icon = queryOne(scope, iconSelector);
  if (!icon) return null;
  return icon.closest("div.gap-sm") || icon.parentElement;
}

function iconRowText(scope, iconSelector) {
  const row = rowByIcon(scope, iconSelector);
  if (!row) return "";
  return textOf(queryOne(row, "span") || queryOne(row, "div.font-barlow"));
}

function locationFromHeader(scope) {
  const row = rowByIcon(scope, ICON_LOCATION);
  if (!row) return "";
  const tip = queryOne(row, "[title], [data-bs-title], [aria-label]");
  const raw = tip?.getAttribute("title") || tip?.getAttribute("data-bs-title") || "";
  if (raw) {
    const decoded = htmlToPlainText(raw);
    if (decoded) return decoded;
  }
  return textOf(queryOne(row, "span") || queryOne(row, "div.font-barlow"));
}

function placesFrom(posting) {
  const value = posting?.jobLocation;
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function locationFromJsonLd(posting) {
  const labels = placesFrom(posting)
    .map((place) => {
      const address = place?.address || {};
      return [address.addressLocality, address.addressRegion, address.addressCountry]
        .filter(Boolean)
        .join(", ");
    })
    .filter(Boolean);
  return labels.join("; ");
}

function formatSalaryK(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  if (Math.abs(n) >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

function salaryUnit(unitText) {
  const unit = String(unitText || "").toUpperCase();
  if (unit.includes("YEAR")) return "Annually";
  if (unit.includes("HOUR")) return "Hourly";
  if (unit.includes("MONTH")) return "Monthly";
  return String(unitText || "").trim();
}

function salaryFromJsonLd(posting) {
  const salary = posting?.baseSalary;
  if (!salary || typeof salary !== "object") return "";
  const value = salary.value && typeof salary.value === "object" ? salary.value : {};
  const min = formatSalaryK(value.minValue);
  const max = formatSalaryK(value.maxValue);
  const unit = salaryUnit(value.unitText);
  if (min && max) return `${min}-${max}${unit ? ` ${unit}` : ""}`;
  if (min || max) return `${min || max}${unit ? ` ${unit}` : ""}`;
  return "";
}

function descriptionFromDocument(document, jobId) {
  const body =
    (jobId && document.getElementById(`${JOB_BODY_ID_PREFIX}${jobId}`)) ||
    queryOne(document, JOB_BODY);
  return textOf(body);
}

function firstHttpUrl(...values) {
  for (const value of values) {
    if (isHttpUrl(value)) return value.trim();
  }
  return "";
}

function applyLinkFromDom(document, pageUrl) {
  const form = queryOne(document, APPLY_FORM);
  const skip = new Set(queryAll(form, APPLY_UNAUTH));
  for (const anchor of queryAll(form, "a[href]")) {
    if (skip.has(anchor)) continue;
    const href = resolveUrl(anchor.getAttribute("href") || anchor.href, pageUrl);
    if (isHttpUrl(href) && !/\/auth\/login/i.test(href)) return href;
  }
  return "";
}

function asStringList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (value == null || value === "") return [];
  return [String(value).trim()].filter(Boolean);
}

function jobTags({ isEasyApply, workplace, seniority, earlyApplicant }) {
  const tags = [];
  if (isEasyApply) tags.push(EASY_APPLY_TAG);
  if (earlyApplicant) tags.push("Be an Early Applicant");
  if (workplace) tags.push(workplace);
  if (seniority) tags.push(seniority);
  return tags;
}

function hasEarlyApplicant(header) {
  return /be an early applicant/i.test(header.textContent || "");
}

function jobUrlFrom(pageUrl) {
  return firstHttpUrl(pageUrl) || pageUrl;
}

/** A company label as a string, or null. Never `String(object)`. */
export function companyNameOf(value) {
  if (typeof value === "string") {
    const text = value.trim();
    if (!text || text === "[object Object]") return null;
    return text;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return companyNameOf(value.name);
  }
  return null;
}

function resolveApplyLink(document, job, jobUrl) {
  if (job.isEasyApply === true) {
    return firstHttpUrl(jobUrl);
  }
  return (
    firstHttpUrl(resolveApplyUrl(job.applyUrl, jobUrl)) ||
    applyLinkFromDom(document, jobUrl) ||
    firstHttpUrl(jobUrl)
  );
}

function companyNameFromDom(document) {
  for (const anchor of queryAll(document, COMPANY_PROFILE_LINK)) {
    const text = textOf(anchor);
    if (text) return text;
  }
  return "";
}

function companyNameFrom(document, job, org, listCompanyName) {
  return (
    companyNameOf(job.companyName) ||
    companyNameOf(org) ||
    companyNameOf(companyNameFromDom(document)) ||
    companyNameOf(listCompanyName)
  );
}

function companyLogoFrom(header, org) {
  const headerImg =
    queryOne(header, 'a[href^="/company/"] picture img') ||
    queryOne(header, "picture img") ||
    queryOne(header, "img");
  const logoUrl = org.logo?.url || org.logo || "";
  return firstHttpUrl(headerImg?.getAttribute("src") || headerImg?.src, logoUrl) || "";
}

function companyBox(document) {
  for (const box of queryAll(document, "div.bg-white.rounded-3.p-md")) {
    if (queryOne(box, ICON_HQ) || queryOne(box, ICON_FOUNDED)) return box;
  }
  return null;
}

function companyHqFrom(box) {
  const text = iconRowText(box, ICON_HQ);
  return text.replace(/^HQ:\s*/i, "");
}

function headingSection(document, title) {
  const heading = firstElementByText(document, "h2", title);
  if (!heading) return null;
  return heading.parentElement;
}

function benefitsFrom(document, posting) {
  const fromJson = asStringList(posting?.jobBenefits);
  if (fromJson.length) return fromJson;
  const section = headingSection(document, "Compensation & Benefits");
  if (!section) return [];
  return queryAll(section, "li")
    .map((item) => textOf(item))
    .filter(Boolean);
}

/**
 * Built In job record from JSON-LD, jobPostInit, and the header DOM.
 * Salary prefers JSON-LD baseSalary. Skills stay off the record.
 * A non-empty jobPostInit applyUrl is the sign-in signal.
 */
export function parseDetail(
  html,
  pageUrl = "",
  { companyName: listCompanyName, now = new Date() } = {},
) {
  const document = documentFromHtml(html);
  const posting = parseJobPostingJsonLd(html);
  const init = parseJobPostInit(html);
  const job = init?.job ?? {};
  const jobId = String(job.id || posting?.identifier?.value || "");
  const header = headerRoot(document);
  const org = posting?.hiringOrganization ?? {};
  const isEasyApply = job.isEasyApply === true;
  const jobUrl = jobUrlFrom(pageUrl);
  const workplace = iconRowText(header, ICON_WORKPLACE);
  const seniority = iconRowText(header, ICON_SENIORITY);
  const box = companyBox(document);
  const title =
    textOf(queryOne(header, TITLE_HEADING) || queryOne(document, TITLE_HEADING)) ||
    job.title ||
    posting?.title ||
    "";
  const applyFromInit = String(job.applyUrl || "").trim();
  const postedAgo = postedAgoText(iconRowText(header, ICON_POSTED));
  const crawlTime = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const companyProfileUrl = companyProfileUrlFrom(document, org, jobUrl);
  const companyWebsite = companyWebsiteFrom(document, org, jobUrl, companyProfileUrl, box);
  const companySocials = companySocialsFrom(document, jobUrl);

  return {
    applyUrl: resolveApplyLink(document, job, jobUrl),
    title,
    description:
      descriptionFromDocument(document, jobId) || htmlToPlainText(posting?.description || ""),
    companyName: companyNameFrom(document, job, org, listCompanyName),
    location: locationFromJsonLd(posting) || locationFromHeader(header),
    workMode: workModeFrom(workplace),
    employmentType: String(posting?.employmentType || "").trim(),
    seniority,
    salary: salaryFromJsonLd(posting) || iconRowText(header, ICON_SALARY),
    ...resolvePostedAt({
      datePosted: String(posting?.datePosted || "").trim(),
      postedAgo,
      now: crawlTime,
    }),
    postedAgo,
    crawledAt: crawlTime.toISOString(),
    badges: jobTags({
      isEasyApply,
      workplace,
      seniority,
      earlyApplicant: hasEarlyApplicant(header),
    }),
    industryTags: asStringList(posting?.industry),
    benefits: benefitsFrom(document, posting),
    companyLogo: companyLogoFrom(header, org),
    companyHq: box ? companyHqFrom(box) : "",
    companySize: box ? iconRowText(box, ICON_EMPLOYEES) : "",
    companyFounded: box ? iconRowText(box, ICON_FOUNDED).replace(/^year founded:\s*/i, "") : "",
    companyWebsite,
    companyProfileUrl,
    companySocials,
    meta: {
      id: jobId,
      isEasyApply,
      isSaved: job.isSaved === true,
      isSignedIn: Boolean(applyFromInit),
      isLoggedIn: typeof init?.isLoggedIn === "boolean" ? init.isLoggedIn : undefined,
      applyUrl: job.applyUrl || "",
    },
  };
}

export function hasDeclaredValue(record, key) {
  return isFound(record?.[key]);
}

/** Core ingest fields that must be present before enqueue. */
export function requiredRecordIssues(record) {
  const issues = [];
  if (!isHttpUrl(record?.applyUrl)) issues.push("applyUrl");
  if (!String(record?.companyName || "").trim()) issues.push("companyName");
  if (!String(record?.title || "").trim()) issues.push("title");
  if (!String(record?.description || "").trim()) issues.push("description");
  return issues;
}
