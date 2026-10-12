import { isHttpUrl } from "../../lib/httpUrl.js";
import { workModeFrom } from "../../routineKit/workMode.js";

import { resolveApplyUrl } from "./applyUrl.js";
import {
  APPLY_FORM,
  APPLY_UNAUTH,
  COMPANY_TITLE,
  EASY_APPLY_TAG,
  HEADER_SCOPE,
  ICON_LOCATION,
  ICON_POSTED,
  ICON_SALARY,
  ICON_SENIORITY,
  ICON_WORKPLACE,
  JOB_BODY_ID_PREFIX,
  SKILLS_HEADING,
  SKILLS_HEADING_TEXT,
} from "./constants.js";
import { documentFromHtml, htmlToPlainText, resolveUrl, textOf } from "./html.js";
import { parseJobPostingJsonLd, parseJobPostInit } from "./parseInit.js";

function headerRoot(document) {
  return document.querySelector(HEADER_SCOPE) || document;
}

function iconRow(scope, iconSelector) {
  const icon = scope.querySelector(iconSelector);
  if (!icon) return null;
  if (icon.nextElementSibling) return icon.parentElement;
  return (
    icon.closest(".d-flex.align-items-start.gap-sm") ||
    icon.parentElement?.parentElement ||
    icon.parentElement
  );
}

function iconRowText(scope, iconSelector) {
  return textOf(iconRow(scope, iconSelector)?.querySelector("span"));
}

function locationFromHeader(scope) {
  const row = iconRow(scope, ICON_LOCATION);
  if (!row) return "";
  const tip = row.querySelector("[title], [data-bs-title], [aria-label]");
  const raw = tip?.getAttribute("title") || tip?.getAttribute("data-bs-title") || "";
  if (raw) {
    const decoded = htmlToPlainText(raw);
    if (decoded) return decoded;
  }
  return textOf(row.querySelector("span"));
}

function locationFromJsonLd(posting) {
  const places = Array.isArray(posting?.jobLocation)
    ? posting.jobLocation
    : posting?.jobLocation
      ? [posting.jobLocation]
      : [];
  const labels = places
    .map((place) => {
      const address = place?.address || {};
      return [address.addressLocality, address.addressRegion, address.addressCountry]
        .filter(Boolean)
        .join(", ");
    })
    .filter(Boolean);
  return labels.join("; ");
}

function skillsFromDocument(document) {
  for (const heading of document.querySelectorAll(SKILLS_HEADING)) {
    if (textOf(heading) !== SKILLS_HEADING_TEXT) continue;
    const list = heading.parentElement?.querySelector("ul") || heading.nextElementSibling;
    if (!list) return [];
    return [...list.querySelectorAll("li")].map((item) => textOf(item)).filter(Boolean);
  }
  return [];
}

function descriptionFromDocument(document, jobId) {
  const body =
    document.getElementById(`${JOB_BODY_ID_PREFIX}${jobId}`) ||
    document.querySelector(`[id^="${JOB_BODY_ID_PREFIX}"]`);
  return textOf(body);
}

function firstHttpUrl(...values) {
  for (const value of values) {
    if (isHttpUrl(value)) return value.trim();
  }
  return "";
}

function applyLinkFromDom(document, pageUrl) {
  const form = document.querySelector(APPLY_FORM);
  const anchors = [...(form?.querySelectorAll("a[href]") ?? [])];
  for (const anchor of anchors) {
    if (anchor.matches(APPLY_UNAUTH)) continue;
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

function companyTags(posting) {
  return asStringList(posting?.industry);
}

function jobTags({ isEasyApply, workplace, seniority, earlyApplicant }) {
  const tags = [];
  if (isEasyApply) tags.push(EASY_APPLY_TAG);
  if (earlyApplicant) tags.push("Be an Early Applicant");
  if (workplace) tags.push(workplace);
  if (seniority) tags.push(seniority);
  return tags;
}

function hasEarlyApplicant(document) {
  return /be an early applicant/i.test(headerRoot(document).textContent || "");
}

function jobUrlFrom(document, pageUrl) {
  const canonical = document.querySelector("link[rel=canonical]")?.getAttribute("href") || "";
  return firstHttpUrl(pageUrl, canonical) || pageUrl;
}

function resolveApplyLink(document, job, jobUrl) {
  return (
    firstHttpUrl(resolveApplyUrl(job.applyUrl, jobUrl)) ||
    applyLinkFromDom(document, jobUrl) ||
    firstHttpUrl(jobUrl)
  );
}

function postedAgoFrom(header, posting) {
  return (
    iconRowText(header, ICON_POSTED) ||
    textOf(header.querySelector(`${ICON_POSTED} + span`)) ||
    String(posting?.datePosted || "")
  );
}

function companyNameFrom(document, job, org) {
  return (
    textOf(document.querySelector(`${HEADER_SCOPE} ${COMPANY_TITLE}, ${HEADER_SCOPE} h2`)) ||
    job.companyName ||
    org.name ||
    ""
  );
}

function companyLogoFrom(document, org) {
  const headerImg = document.querySelector(`${HEADER_SCOPE} picture img, ${HEADER_SCOPE} img`);
  const logoUrl = org.logo?.url || org.logo || "";
  return firstHttpUrl(headerImg?.getAttribute("src") || headerImg?.src, logoUrl) || "";
}

/**
 * Built In job record from JSON-LD, jobPostInit, and the header DOM.
 * Salary is read only from the job header, never Similar Jobs.
 */
export function parseDetail(html, pageUrl = "") {
  const document = documentFromHtml(html);
  const posting = parseJobPostingJsonLd(html);
  const init = parseJobPostInit(html);
  const job = init?.job ?? {};
  const jobId = String(job.id || posting?.identifier?.value || "");
  const header = headerRoot(document);
  const org = posting?.hiringOrganization ?? {};
  const isEasyApply = job.isEasyApply === true;
  const jobUrl = jobUrlFrom(document, pageUrl);
  const workplace = iconRowText(header, ICON_WORKPLACE);
  const title =
    textOf(document.querySelector("h1 span") || document.querySelector("h1")) ||
    job.title ||
    posting?.title ||
    "";

  return {
    applyUrl: resolveApplyLink(document, job, jobUrl),
    title,
    description:
      descriptionFromDocument(document, jobId) || htmlToPlainText(posting?.description || ""),
    companyName: companyNameFrom(document, job, org),
    location: locationFromHeader(header) || locationFromJsonLd(posting),
    workMode: workModeFrom(workplace),
    employmentType: String(posting?.employmentType || "").trim(),
    seniority: iconRowText(header, ICON_SENIORITY),
    salary: iconRowText(header, ICON_SALARY),
    postedAt: String(posting?.datePosted || "").trim(),
    badges: jobTags({
      isEasyApply,
      workplace,
      seniority: iconRowText(header, ICON_SENIORITY),
      earlyApplicant: hasEarlyApplicant(document),
    }),
    industryTags: companyTags(posting),
    benefits: asStringList(posting?.jobBenefits),
    skills: skillsFromDocument(document),
    companyLogo: companyLogoFrom(document, org),
    companyWebsite: firstHttpUrl(org.sameAs, resolveUrl(org.sameAs, jobUrl)),
    meta: {
      id: jobId,
      isEasyApply,
      isSaved: job.isSaved === true,
      isLoggedIn: init?.isLoggedIn === true,
      applyUrl: job.applyUrl || "",
    },
  };
}
