import { declareJobFields, field, FIELD_TYPES } from "../../routineKit/declaredFields.js";
import { defineRunView, fieldGroup, RUN_COMPONENT, RUN_STAT } from "../../routineKit/runView.js";

/**
 * Fields HiringCafe actually provides. Socials are rare; company profile is
 * metadata built from the org external id when present.
 */
export const HIRINGCAFE_FIELDS = declareJobFields([
  field("location", "Location", FIELD_TYPES.STRING),
  field("workMode", "Work mode", FIELD_TYPES.STRING),
  field("employmentType", "Employment type", FIELD_TYPES.STRING),
  field("seniority", "Seniority", FIELD_TYPES.STRING),
  field("salary", "Salary", FIELD_TYPES.STRING),
  field("postedAt", "Posted", FIELD_TYPES.DATE),
  field("postedAgo", "Posted text", FIELD_TYPES.STRING),
  field("postedAtSource", "Posted source", FIELD_TYPES.STRING),
  field("applicantCount", "Applicants", FIELD_TYPES.NUMBER),
  field("badges", "Badges", FIELD_TYPES.LIST),
  field("industryTags", "Industry", FIELD_TYPES.LIST),
  field("benefits", "Benefits", FIELD_TYPES.LIST),
  field("skills", "Skills", FIELD_TYPES.LIST),
  field("originalPostUrl", "Original post", FIELD_TYPES.URL),
  field("companyLogo", "Logo", FIELD_TYPES.URL),
  field("companyWebsite", "Website", FIELD_TYPES.URL),
  field("companyProfileUrl", "Company profile", FIELD_TYPES.URL),
  field("companySize", "Company size", FIELD_TYPES.STRING),
  field("companyHq", "Headquarters", FIELD_TYPES.STRING),
  field("companyFounded", "Founded", FIELD_TYPES.STRING),
  field("companyAbout", "About", FIELD_TYPES.STRING),
  field("companySocial", "Social", FIELD_TYPES.OBJECT),
  field("requisitionId", "Requisition", FIELD_TYPES.STRING),
]);

export const HIRINGCAFE_RUN_VIEW = defineRunView({
  groups: [
    fieldGroup("job", "Job", [
      "applyUrl",
      "title",
      "description",
      "location",
      "workMode",
      "employmentType",
      "seniority",
      "salary",
      "postedAt",
      "originalPostUrl",
      "applicantCount",
    ]),
    fieldGroup("company", "Company", [
      "companyName",
      "companyLogo",
      "companyWebsite",
      "companyProfileUrl",
      "companySize",
      "companyHq",
      "companyFounded",
      "companyAbout",
      "companySocial",
    ]),
    fieldGroup("skills", "Skills", ["skills"]),
    fieldGroup("tags", "Tags", ["badges", "industryTags", "benefits"]),
  ],
  components: [RUN_COMPONENT.STEPPER, RUN_COMPONENT.FIELD_GROUPS, RUN_COMPONENT.RESULTS],
  stats: [
    RUN_STAT.CURSOR,
    RUN_STAT.BLOCKS,
    RUN_STAT.OUTCOMES,
    RUN_STAT.QUEUE,
    RUN_STAT.RECENT_JOBS,
  ],
  settings: [],
});
