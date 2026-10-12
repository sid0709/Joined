import { isHttpUrl } from "../../lib/httpUrl.js";
import { queryOne } from "../../routineKit/extract.js";
import { isFound } from "../../routineKit/html.js";
import { parseJobPostingJsonLd } from "../../routineKit/jsonLd.js";

import { METADATA_LIMIT_BYTES, POSTED_TEXT_RE, TITLE_HEADING } from "./constants.js";
import { documentFromHtml, htmlToPlainText, resolveUrl, textOf } from "./html.js";
import { hasNextDataJob, readDetailJob } from "./parseNextData.js";
import {
  asFiniteNumber,
  asStringList,
  asText,
  assignProvided,
  benefitsFrom,
  companyLogoFrom,
  companyNameOf,
  firstHttpOrWebsite,
  hiringCafeMetadata,
  metadataFits,
  objectBag,
  postedFrom,
  requisitionIdOf,
  salaryFrom,
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

function companyLogoFromDom(document) {
  const img =
    queryOne(document, "img[alt]") ||
    queryOne(document, "picture img") ||
    queryOne(document, "img");
  const src = img?.getAttribute("src") || img?.src || "";
  return websiteUrl(src);
}

function recordFromJob(job, pageUrl, extras = {}) {
  const document = extras.document;
  const posting = extras.posting ?? {};
  const info = objectBag(job.job_information);
  const v5 = objectBag(job.v5_processed_job_data);
  const enriched = objectBag(job.enriched_company_data);
  const attributed = objectBag(job.attributed_org);
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
  const logo = companyLogoFrom(extras.logo, org.logo?.url, org.logo, extras.domLogo);

  const applyUrl =
    firstHttpOrWebsite(job.apply_url, extras.applyUrl) ||
    websiteUrl(job.apply_url) ||
    websiteUrl(extras.applyUrl);
  const record = {
    applyUrl,
    applyLink: applyUrl,
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
  };

  assignProvided(
    record,
    "location",
    asText(v5.formatted_workplace_location) || asText(extras.location),
  );
  assignProvided(record, "workMode", workModeFrom(v5.workplace_type));
  assignProvided(
    record,
    "employmentType",
    asStringList(v5.commitment).join(", ") || asText(posting.employmentType),
  );
  assignProvided(record, "seniority", asText(v5.seniority_level));
  assignProvided(record, "salary", salaryFrom(v5));
  assignProvided(record, "postedAt", posted.postedAt);
  assignProvided(record, "postedAgo", posted.postedAgo);
  assignProvided(record, "postedAtSource", posted.postedAtSource);
  assignProvided(record, "applicantCount", applicantCount);
  assignProvided(
    record,
    "badges",
    [v5.workplace_type, ...asStringList(v5.commitment), asText(v5.seniority_level)].filter(Boolean),
  );
  assignProvided(
    record,
    "industryTags",
    asStringList(enriched.industries || attributed.industries),
  );
  assignProvided(record, "benefits", benefitsFrom(v5));
  assignProvided(record, "skills", asStringList(v5.technical_tools));
  assignProvided(record, "originalPostUrl", websiteUrl(pageUrl) || asText(pageUrl));
  assignProvided(record, "companyLogo", logo);
  assignProvided(record, "companyWebsite", website);
  assignProvided(
    record,
    "companySize",
    enriched.nb_employees != null ? String(enriched.nb_employees) : "",
  );
  assignProvided(record, "companyHq", asText(enriched.hq_country));
  assignProvided(
    record,
    "companyFounded",
    enriched.year_founded != null ? String(enriched.year_founded) : "",
  );
  assignProvided(record, "companyAbout", asText(enriched.tagline || v5.company_tagline));
  assignProvided(record, "requisitionId", requisitionIdOf(job));

  record.metadata = hiringCafeMetadata(job, {
    ...extras,
    postedAtSource: posted.postedAtSource,
    companyWebsite: website,
  });
  record.meta = {
    id: requisitionIdOf(job),
    sourceId: asText(job.id),
    collapseKey: asText(job.collapse_key),
  };
  return record;
}

/**
 * HiringCafe job record from `__NEXT_DATA__.props.pageProps.job`, with JSON-LD
 * and DOM fallbacks only for values HiringCafe itself rendered.
 */
export function parseDetail(html, pageUrl = "", extras = {}) {
  const document = documentFromHtml(html);
  const job = readDetailJob(html);
  const posting = parseJobPostingJsonLd(html) ?? {};
  const postedRaw = extras.postedRaw || postedRawFrom(document);
  const parsed = recordFromJob(job ?? {}, pageUrl, {
    document,
    posting,
    postedRaw,
    companyName: extras.companyName,
    applyUrl: extras.applyUrl,
    cardHref: extras.cardHref,
    logo: extras.logo,
    location: extras.location,
    domLogo: companyLogoFromDom(document),
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

export function recordReadyToEnqueue(record, limit = METADATA_LIMIT_BYTES) {
  const issues = requiredRecordIssues(record);
  if (issues.length) return { ok: false, reason: "invalid", issues };
  if (!metadataFits(record?.metadata, limit)) return { ok: false, reason: "metadata-size", issues };
  return { ok: true, issues };
}
