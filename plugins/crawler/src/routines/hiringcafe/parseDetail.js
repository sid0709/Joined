import { isHttpUrl } from "../../lib/httpUrl.js";
import { queryOne } from "../../routineKit/extract.js";
import { isFound } from "../../routineKit/html.js";
import { parseJobPostingJsonLd } from "../../routineKit/jsonLd.js";

import { POSTED_TEXT_RE, TITLE_HEADING } from "./constants.js";
import { documentFromHtml, htmlToPlainText, resolveUrl, textOf } from "./html.js";
import { hasNextDataJob, readDetailJob } from "./parseNextData.js";
import {
  asFiniteNumber,
  asStringList,
  asText,
  benefitsFrom,
  companyLogoFrom,
  companyNameOf,
  companyProfileUrl,
  faviconUrlFor,
  firstHttpOrWebsite,
  postedFrom,
  requisitionIdOf,
  salaryFrom,
  socialLinks,
  websiteUrl,
  workModeFrom,
} from "./values.js";

function postedRawFrom(document) {
  for (const node of document.querySelectorAll("span, time, p, div")) {
    const text = textOf(node);
    if (POSTED_TEXT_RE.test(text) && text.length < 80) return text;
  }
  return "";
}

function companyLogoFromDom(document, website) {
  const img =
    queryOne(document, "img[alt]") ||
    queryOne(document, "picture img") ||
    queryOne(document, "img");
  const src = img?.getAttribute("src") || img?.src || "";
  return companyLogoFrom(src, faviconUrlFor(website));
}

function recordFromJob(job, pageUrl, extras = {}) {
  const document = extras.document;
  const posting = extras.posting ?? {};
  const info =
    job.job_information && typeof job.job_information === "object" ? job.job_information : {};
  const v5 =
    job.v5_processed_job_data && typeof job.v5_processed_job_data === "object"
      ? job.v5_processed_job_data
      : {};
  const enriched =
    job.enriched_company_data && typeof job.enriched_company_data === "object"
      ? job.enriched_company_data
      : {};
  const attributed =
    job.attributed_org && typeof job.attributed_org === "object" ? job.attributed_org : {};
  const org = posting.hiringOrganization ?? {};
  const website = firstHttpOrWebsite(
    enriched.homepage_uri,
    attributed.website,
    v5.company_website,
    org.sameAs,
  );
  const posted = postedFrom(v5, posting.datePosted, extras.postedRaw);
  const applicantCount = asFiniteNumber(info.num_applies);
  const description = htmlToPlainText(info.description || posting.description || "");
  const logo = companyLogoFrom(
    extras.logo,
    org.logo?.url,
    org.logo,
    extras.domLogo,
    faviconUrlFor(website),
  );

  return {
    applyUrl: firstHttpOrWebsite(job.apply_url, extras.applyUrl),
    title:
      asText(info.title) ||
      asText(v5.core_job_title) ||
      asText(posting.title) ||
      (document ? textOf(queryOne(document, TITLE_HEADING)) : ""),
    description,
    companyName:
      companyNameOf(enriched.name) ||
      companyNameOf(attributed.name) ||
      companyNameOf(v5.company_name) ||
      companyNameOf(org) ||
      companyNameOf(extras.companyName),
    location: asText(v5.formatted_workplace_location) || asText(extras.location),
    workMode: workModeFrom(v5.workplace_type),
    employmentType: asStringList(v5.commitment).join(", ") || asText(posting.employmentType),
    seniority: asText(v5.seniority_level),
    salary: salaryFrom(v5),
    postedAt: posted.postedAt,
    postedAgo: posted.postedAgo,
    postedAtSource: posted.postedAtSource,
    applicantCount: applicantCount == null ? "" : applicantCount,
    badges: [v5.workplace_type, ...asStringList(v5.commitment), asText(v5.seniority_level)].filter(
      Boolean,
    ),
    industryTags: asStringList(enriched.industries || attributed.industries),
    benefits: benefitsFrom(v5),
    skills: asStringList(v5.technical_tools),
    originalPostUrl: websiteUrl(pageUrl) || asText(pageUrl),
    companyLogo: logo,
    companyWebsite: website,
    companyProfileUrl: companyProfileUrl(job, extras.origin),
    companySize: enriched.nb_employees != null ? String(enriched.nb_employees) : "",
    companyHq: asText(enriched.hq_country),
    companyFounded: enriched.year_founded != null ? String(enriched.year_founded) : "",
    companyAbout: asText(enriched.tagline || v5.company_tagline),
    companySocial: socialLinks(job),
    requisitionId: requisitionIdOf(job),
    meta: {
      id: requisitionIdOf(job),
      sourceId: asText(job.id),
      collapseKey: asText(job.collapse_key),
    },
  };
}

/**
 * HiringCafe job record from `__NEXT_DATA__.props.pageProps.job`, with JSON-LD
 * and DOM fallbacks for logo, posted text, and title.
 */
export function parseDetail(html, pageUrl = "", extras = {}) {
  const document = documentFromHtml(html);
  const job = readDetailJob(html);
  const posting = parseJobPostingJsonLd(html) ?? {};
  const postedRaw = extras.postedRaw || postedRawFrom(document);
  const websiteHint = firstHttpOrWebsite(
    job?.enriched_company_data?.homepage_uri,
    job?.attributed_org?.website,
    job?.v5_processed_job_data?.company_website,
    posting?.hiringOrganization?.sameAs,
  );
  const parsed = job
    ? recordFromJob(job, pageUrl, {
        document,
        posting,
        postedRaw,
        companyName: extras.companyName,
        applyUrl: extras.applyUrl,
        origin: extras.origin,
        domLogo: companyLogoFromDom(document, websiteHint),
      })
    : recordFromJob({}, pageUrl, {
        document,
        posting,
        postedRaw,
        companyName: extras.companyName,
        applyUrl: extras.applyUrl,
        origin: extras.origin,
        domLogo: companyLogoFromDom(document, websiteHint),
      });
  if (!parsed.applyUrl && extras.applyUrl) parsed.applyUrl = firstHttpOrWebsite(extras.applyUrl);
  if (!parsed.originalPostUrl && pageUrl) parsed.originalPostUrl = resolveUrl(pageUrl, pageUrl);
  return parsed;
}

export function parseDetailNeedsJob(html) {
  return !hasNextDataJob(html);
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
