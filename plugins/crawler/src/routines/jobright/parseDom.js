import { isHttpUrl } from "../../lib/httpUrl.js";
import { queryAll, queryOne } from "../../routineKit/extract.js";
import { firstElementByText, documentFromHtml, resolveUrl, textOf } from "../../routineKit/html.js";

import {
  APPLY_BUTTON,
  COMPANY_ABOUT,
  COMPANY_DATA_LINK,
  COMPANY_LINK,
  COMPANY_LOGO,
  COMPANY_NAME,
  COMPANY_NAME_HEADING,
  COMPANY_SECTION,
  COMPANY_SIZE_ICON,
  COMPANY_TAGS,
  EARLY_APPLICANT_TAG,
  EMPLOYMENT_ICON,
  EXPERIENCE_ICON,
  JOB_INFO_PATH,
  JOB_LINK,
  JOB_SUMMARY,
  JOB_TAG,
  JOB_TITLE,
  LIST_TEXT,
  LOCATION_ICON,
  ORIGINAL_POST_LINK,
  OVERVIEW,
  PUBLISH_TIME,
  QUALIFICATION_TAG,
  SALARY_ICON,
  SECTION_LABEL,
  SENIORITY_ICON,
  SKILLS_SECTION,
  SOCIAL_LINK,
  WORK_MODE_ICON,
} from "./constants.js";
import {
  asStringList,
  filterJobBadges,
  firstHttpUrl,
  joinSections,
  socialLinks,
  workModeFrom,
} from "./values.js";

function iconText(scope, selector) {
  const icon = queryOne(scope, selector);
  if (!icon) return "";
  const sibling = icon.nextElementSibling;
  if (sibling) return textOf(sibling);
  return textOf(icon.parentElement);
}

function labeledSectionTexts(root, label) {
  const heading =
    firstElementByText(root, SECTION_LABEL, label) || firstElementByText(root, "h4", label);
  if (!heading) return [];
  const container = heading.closest("section, div") || heading.parentElement;
  return queryAll(container, LIST_TEXT)
    .map((node) => textOf(node))
    .filter(Boolean);
}

function skillsFrom(document) {
  const section = queryOne(document, SKILLS_SECTION);
  if (!section) return [];
  const chips = queryAll(section, QUALIFICATION_TAG)
    .map((node) => textOf(node))
    .filter(Boolean);
  if (chips.length) return chips;
  return queryAll(section, "span")
    .map((node) => textOf(node))
    .filter((text) => text && text.length < 40);
}

function hrefOf(root, selector, pageUrl) {
  const node = queryOne(root, selector);
  const href = node?.getAttribute("href") || node?.href || "";
  return firstHttpUrl(href, resolveUrl(href, pageUrl));
}

function companySocialFrom(document, pageUrl) {
  const links = {};
  const company = queryOne(document, COMPANY_SECTION) || document;
  for (const anchor of queryAll(company, SOCIAL_LINK)) {
    const href = firstHttpUrl(
      anchor.getAttribute("href"),
      resolveUrl(anchor.getAttribute("href"), pageUrl),
    );
    if (!href) continue;
    try {
      const host = new URL(href).hostname.replace(/^www\./, "");
      if (host.includes("linkedin.com")) links.linkedin = href;
      else if (host === "x.com" || host.includes("twitter.com")) links.x = href;
      else if (host.includes("facebook.com")) links.facebook = href;
      else if (host.includes("github.com")) links.github = href;
    } catch {
      // Ignore unparsable hrefs.
    }
  }
  return socialLinks(links);
}

function companyFoundedFrom(companyRoot) {
  for (const use of queryAll(companyRoot, "use")) {
    const href = use.getAttribute("href") || use.getAttribute("xlink:href") || "";
    if (!href.endsWith("#date")) continue;
    return textOf(use.closest("div") || use.parentElement).replace(/^founded in\s+/i, "");
  }
  return "";
}

function companyHqFrom(companyRoot) {
  for (const use of queryAll(companyRoot, "use")) {
    const href = use.getAttribute("href") || use.getAttribute("xlink:href") || "";
    if (!href.endsWith("#location")) continue;
    const svg = use.closest("svg");
    const link = queryOne(svg?.parentElement, COMPANY_DATA_LINK);
    if (link) return textOf(link);
  }
  const icon = queryOne(companyRoot, 'svg[aria-label="location"]');
  if (icon) {
    const link = queryOne(icon.parentElement, COMPANY_DATA_LINK);
    return textOf(link) || iconText(companyRoot, 'svg[aria-label="location"]');
  }
  return "";
}

export function jobInfoUrlFrom(html, pageUrl = "") {
  const document = documentFromHtml(html);
  for (const anchor of queryAll(document, JOB_LINK)) {
    const href = anchor.getAttribute("href") || anchor.href || "";
    if (!href.includes(JOB_INFO_PATH)) continue;
    const resolved = resolveUrl(href, pageUrl);
    if (isHttpUrl(resolved)) return resolved;
  }
  try {
    const current = new URL(pageUrl);
    if (current.pathname.includes(JOB_INFO_PATH)) return current.href;
  } catch {
    return "";
  }
  return "";
}

/** Salary is on list cards (`svg[aria-label=money] + span`), not on most detail pages. */
export function salaryFromJobCard(html, jobId) {
  if (!jobId) return "";
  const document = documentFromHtml(html);
  const id = String(jobId);
  const card = document.getElementById(id);
  if (!card) return "";
  return iconText(card, SALARY_ICON);
}

function badgesFrom(document) {
  const tags = [...queryAll(document, EARLY_APPLICANT_TAG), ...queryAll(document, JOB_TAG)]
    .map((node) => textOf(node))
    .filter(Boolean);
  return filterJobBadges(tags);
}

function applicantCountFrom(document) {
  return asStringList(
    queryAll(document, JOB_TAG)
      .map((node) => textOf(node))
      .join("\n"),
  ).reduce((count, tag) => {
    if (/school alumni/i.test(tag)) return count;
    const match = tag.match(/(\d+)\s+applicant/i);
    return match ? Number(match[1]) : count;
  }, "");
}

/** Job record from the overlay / SSR DOM when `__NEXT_DATA__` is missing. */
export function parseFromDom(html, pageUrl = "") {
  const document = documentFromHtml(html);
  const overview = queryOne(document, OVERVIEW) || document;
  const companyRoot = queryOne(document, COMPANY_SECTION) || document;
  const skillsRoot = queryOne(document, SKILLS_SECTION) || document;
  const responsibilities = labeledSectionTexts(document, "Responsibilities");
  const required = labeledSectionTexts(skillsRoot, "Required");
  const preferred = labeledSectionTexts(skillsRoot, "Preferred");
  const benefits = labeledSectionTexts(document, "Benefits");
  const summary = textOf(queryOne(document, JOB_SUMMARY));
  const sections = {
    summary,
    responsibilities,
    qualifications: { required, preferred },
    benefits,
  };
  const applyFromOrigin = hrefOf(document, ORIGINAL_POST_LINK, pageUrl);
  const applyButton = queryOne(document, APPLY_BUTTON);
  const applyFromButton = firstHttpUrl(
    applyButton?.getAttribute("data-href"),
    applyButton?.getAttribute("href"),
  );
  const logo = queryOne(overview, COMPANY_LOGO) || queryOne(document, COMPANY_LOGO);

  return {
    applyUrl: firstHttpUrl(applyFromOrigin, applyFromButton),
    title: textOf(queryOne(document, JOB_TITLE)),
    description: joinSections([
      summary,
      ...responsibilities,
      ...required,
      ...preferred,
      ...benefits,
    ]),
    companyName: textOf(
      queryOne(companyRoot, COMPANY_NAME_HEADING) || queryOne(document, COMPANY_NAME),
    ),
    location: iconText(overview, LOCATION_ICON),
    workMode: workModeFrom(iconText(overview, WORK_MODE_ICON)),
    employmentType: iconText(overview, EMPLOYMENT_ICON),
    seniority: iconText(overview, SENIORITY_ICON),
    yearsOfExperience: iconText(overview, EXPERIENCE_ICON),
    salary: iconText(overview, SALARY_ICON),
    postedAt: textOf(queryOne(document, PUBLISH_TIME)).replace(/^[^\w]+/, ""),
    applicantCount: applicantCountFrom(document),
    badges: badgesFrom(document),
    industryTags: queryAll(document, COMPANY_TAGS)
      .map((node) => textOf(node))
      .filter(Boolean),
    benefits,
    skills: skillsFrom(document),
    descriptionSections: sections,
    originalPostUrl: applyFromOrigin,
    companyLogo: firstHttpUrl(logo?.getAttribute("src"), logo?.src),
    companyWebsite: firstHttpUrl(
      hrefOf(companyRoot, COMPANY_LINK, pageUrl),
      hrefOf(document, COMPANY_LINK, pageUrl),
    ),
    companySize: iconText(companyRoot, COMPANY_SIZE_ICON),
    companyHq: companyHqFrom(companyRoot),
    companyFounded: companyFoundedFrom(companyRoot),
    companyAbout: textOf(queryOne(companyRoot, COMPANY_ABOUT)),
    companySocial: companySocialFrom(document, pageUrl),
  };
}
