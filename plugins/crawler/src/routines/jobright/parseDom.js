import { isHttpUrl } from "../../lib/httpUrl.js";
import { documentFromHtml, resolveUrl, textOf } from "../../routineKit/html.js";

import {
  APPLY_BUTTON,
  COMPANY_ABOUT,
  COMPANY_LINK,
  COMPANY_LOGO,
  COMPANY_NAME,
  COMPANY_SECTION,
  COMPANY_SIZE_ICON,
  COMPANY_TAGS,
  EMPLOYMENT_ICON,
  EXPERIENCE_ICON,
  JOB_INFO_PATH,
  JOB_LINK,
  JOB_TAG,
  JOB_TITLE,
  LIST_TEXT,
  LOCATION_ICON,
  ORIGINAL_POST_LINK,
  PUBLISH_TIME,
  SECTION_LABEL,
  SENIORITY_ICON,
  SKILLS_SECTION,
  SOCIAL_LINK,
  WORK_MODE_ICON,
} from "./constants.js";
import { asStringList, firstHttpUrl, joinSections, socialLinks, workModeFrom } from "./values.js";

function iconText(document, selector) {
  const icon = document.querySelector(selector);
  if (!icon) return "";
  const sibling = icon.nextElementSibling;
  if (sibling) return textOf(sibling);
  return textOf(icon.parentElement);
}

function labeledSectionTexts(document, label) {
  const headings = [...document.querySelectorAll(SECTION_LABEL)];
  const heading = headings.find((node) => textOf(node).toLowerCase() === label.toLowerCase());
  if (!heading) return [];
  const root = heading.closest("section, div") || heading.parentElement;
  return [...(root?.querySelectorAll(LIST_TEXT) ?? [])].map((node) => textOf(node)).filter(Boolean);
}

function skillsFrom(document) {
  const section = document.querySelector(SKILLS_SECTION);
  if (!section) return [];
  return [...section.querySelectorAll("[class*='skills'] , span")]
    .map((node) => textOf(node))
    .filter((text) => text && text.length < 40);
}

function hrefOf(document, selector, pageUrl) {
  const node = document.querySelector(selector);
  const href = node?.getAttribute("href") || node?.href || "";
  return firstHttpUrl(href, resolveUrl(href, pageUrl));
}

function companySocialFrom(document, pageUrl) {
  const links = {};
  for (const anchor of document.querySelectorAll(
    `${COMPANY_SECTION} ${SOCIAL_LINK}, ${SOCIAL_LINK}`,
  )) {
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

export function jobInfoUrlFrom(html, pageUrl = "") {
  const document = documentFromHtml(html);
  const anchors = [...document.querySelectorAll(JOB_LINK)];
  for (const anchor of anchors) {
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

/** Job record from the overlay / SSR DOM when `__NEXT_DATA__` is missing. */
export function parseFromDom(html, pageUrl = "") {
  const document = documentFromHtml(html);
  const responsibilities = labeledSectionTexts(document, "Responsibilities");
  const required = labeledSectionTexts(document, "Required");
  const preferred = labeledSectionTexts(document, "Preferred");
  const benefits = labeledSectionTexts(document, "Benefits");
  const summary = textOf(
    document.querySelector("[class*='company-summary'], [class*='jobContentBrief']"),
  );
  const sections = {
    summary,
    responsibilities,
    qualifications: { required, preferred },
    benefits,
  };
  const applyFromOrigin = hrefOf(document, ORIGINAL_POST_LINK, pageUrl);
  const applyButton = document.querySelector(APPLY_BUTTON);
  const applyFromButton = firstHttpUrl(
    applyButton?.getAttribute("data-href"),
    applyButton?.getAttribute("href"),
  );

  return {
    applyUrl: firstHttpUrl(applyFromOrigin, applyFromButton),
    title: textOf(document.querySelector(JOB_TITLE)),
    description: joinSections([
      summary,
      ...responsibilities,
      ...required,
      ...preferred,
      ...benefits,
    ]),
    companyName: textOf(
      document.querySelector(`${COMPANY_SECTION} ${COMPANY_NAME}, ${COMPANY_NAME}`),
    ),
    location: iconText(document, LOCATION_ICON),
    workMode: workModeFrom(iconText(document, WORK_MODE_ICON)),
    employmentType: iconText(document, EMPLOYMENT_ICON),
    seniority: iconText(document, SENIORITY_ICON),
    yearsOfExperience: iconText(document, EXPERIENCE_ICON),
    salary: "",
    postedAt: textOf(document.querySelector(PUBLISH_TIME)),
    applicantCount: asStringList(
      [...document.querySelectorAll(JOB_TAG)].map((node) => textOf(node)).join("\n"),
    ).reduce((count, tag) => {
      const match = tag.match(/(\d+)/);
      return match ? Number(match[1]) : count;
    }, ""),
    badges: [...document.querySelectorAll(JOB_TAG)].map((node) => textOf(node)).filter(Boolean),
    industryTags: [...document.querySelectorAll(COMPANY_TAGS)]
      .map((node) => textOf(node))
      .filter(Boolean),
    benefits,
    skills: skillsFrom(document),
    descriptionSections: sections,
    originalPostUrl: applyFromOrigin,
    companyLogo: firstHttpUrl(
      document.querySelector(COMPANY_LOGO)?.getAttribute("src"),
      document.querySelector(COMPANY_LOGO)?.src,
    ),
    companyWebsite: hrefOf(
      document,
      `${COMPANY_SECTION} ${COMPANY_LINK}, ${COMPANY_LINK}`,
      pageUrl,
    ),
    companySize: iconText(document, COMPANY_SIZE_ICON),
    companyHq: iconText(
      document.querySelector(COMPANY_SECTION) || document,
      'svg[aria-label="location"]',
    ),
    companyFounded: "",
    companyAbout: textOf(document.querySelector(COMPANY_ABOUT)),
    companySocial: companySocialFrom(document, pageUrl),
  };
}
