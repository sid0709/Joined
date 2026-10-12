import { documentFromHtml } from "../../routineKit/html.js";

import { NEXT_DATA_SCRIPT } from "./constants.js";
import {
  asFiniteNumber,
  asStringList,
  asText,
  firstHttpUrl,
  joinSections,
  postedAtFrom,
  skillNames,
  socialLinks,
  workModeFrom,
} from "./values.js";

const MATCH_SCORE_KEYS = new Set([
  "industryMatchingScores",
  "skillMatchingScores",
  "recommendationScores",
  "displayScore",
  "rankDesc",
]);

const CONNECTION_KEYS = new Set([
  "personalSocialConnections",
  "socialConnections",
  "jobRecruiter",
  "jobRecruiterProfileUrl",
  "leadership",
]);

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** `props.pageProps.dataSource` from `#__NEXT_DATA__`, or null. */
export function readNextDataSource(html) {
  const document = documentFromHtml(html);
  const script = document.querySelector(NEXT_DATA_SCRIPT);
  const parsed = parseJson(script?.textContent || "");
  const source = parsed?.props?.pageProps?.dataSource;
  if (!source || typeof source !== "object") return null;
  return source;
}

function jobFromSource(source) {
  const job = source?.jobResult;
  return job && typeof job === "object" ? job : null;
}

function companyFromSource(source) {
  const company = source?.companyResult;
  return company && typeof company === "object" ? company : null;
}

function descriptionSectionsFrom(job) {
  const qualifications =
    job?.qualifications && typeof job.qualifications === "object" ? job.qualifications : {};
  return {
    summary: asText(job?.jobSummary),
    responsibilities: asStringList(job?.coreResponsibilities),
    qualifications: {
      required: asStringList(qualifications.mustHave),
      preferred: asStringList(qualifications.preferredHave),
    },
    benefits: asStringList(job?.benefitsSummaries),
  };
}

function descriptionFrom(sections) {
  return joinSections([
    sections.summary,
    ...sections.responsibilities,
    ...sections.qualifications.required,
    ...sections.qualifications.preferred,
    ...sections.benefits,
  ]);
}

function industryTagsFrom(company) {
  const tags = [
    ...asStringList(company?.companyCategories),
    ...asStringList(company?.companyGptCategories),
  ];
  const seen = new Set();
  return tags.filter((tag) => {
    const key = tag.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function badgesFrom(job) {
  return [...asStringList(job?.jobTags), ...asStringList(job?.recommendationTags)];
}

function yearsOfExperienceFrom(job) {
  const years = asFiniteNumber(job?.minYearsOfExperience);
  if (years == null) return "";
  return `${years}+ years`;
}

function omitExcluded(record) {
  for (const key of MATCH_SCORE_KEYS) delete record[key];
  for (const key of CONNECTION_KEYS) delete record[key];
  return record;
}

export function hasNextDataJob(html) {
  return Boolean(jobFromSource(readNextDataSource(html)));
}

/** Job record from JobRight `__NEXT_DATA__`. Null when the page has no jobResult. */
export function parseFromNextData(html) {
  const source = readNextDataSource(html);
  const job = jobFromSource(source);
  if (!job) return null;
  const company = companyFromSource(source) ?? {};
  const sections = descriptionSectionsFrom(job);
  const applyUrl = firstHttpUrl(job.applyLink, job.originalUrl);
  const originalPostUrl = firstHttpUrl(job.originalUrl, job.applyLink);
  const applicantCount = asFiniteNumber(job.applicantsCount);

  return omitExcluded({
    applyUrl,
    title: asText(job.jobTitle),
    description: descriptionFrom(sections),
    companyName: asText(company.companyName),
    location: asText(job.jobLocation) || asStringList(job.jobLocations).join("; "),
    workMode: workModeFrom(job.workModel, job.isRemote),
    employmentType: asText(job.employmentType),
    seniority: asText(job.jobSeniority),
    yearsOfExperience: yearsOfExperienceFrom(job),
    salary: asText(job.salary || job.baseSalary),
    postedAt: postedAtFrom(job.publishTime),
    applicantCount: applicantCount == null ? "" : applicantCount,
    badges: badgesFrom(job),
    industryTags: industryTagsFrom(company),
    benefits: asStringList(job.benefitsSummaries),
    skills: skillNames(job.jdCoreSkills),
    descriptionSections: sections,
    originalPostUrl,
    companyLogo: firstHttpUrl(job.jdLogo),
    companyWebsite: firstHttpUrl(company.companyURL),
    companySize: asText(company.companySize),
    companyHq: asText(company.companyLocation),
    companyFounded: asText(company.companyFoundYear),
    companyAbout: asText(company.companyDesc) || asText(company.gptShortDescription),
    companySocial: socialLinks({
      linkedin: company.companyLinkedinURL,
      twitter: company.companyTwitterURL,
      facebook: company.companyFacebookURL,
    }),
  });
}
