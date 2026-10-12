import { declareJobFields, field, FIELD_TYPES } from "../../routineKit/declaredFields.js";
import { defineRunView, fieldGroup, RUN_COMPONENT, RUN_STAT } from "../../routineKit/runView.js";

/**
 * Fields Built In actually provides. JSON-LD has no skills key, so skills stay
 * undeclared. Applicant count and original post URL are not on the job page.
 * Company website, Built In profile URL, and socials come from the job page
 * only (no extra company-page fetch). baseSalary is optional.
 */
export const BUILTIN_FIELDS = declareJobFields([
  field("location", "Location", FIELD_TYPES.STRING),
  field("workMode", "Work mode", FIELD_TYPES.STRING),
  field("employmentType", "Employment type", FIELD_TYPES.STRING),
  field("seniority", "Seniority", FIELD_TYPES.STRING),
  field("salary", "Salary", FIELD_TYPES.STRING),
  field("postedAt", "Posted", FIELD_TYPES.DATE),
  field("postedAgo", "Posted ago", FIELD_TYPES.STRING),
  field("badges", "Badges", FIELD_TYPES.LIST),
  field("industryTags", "Industry", FIELD_TYPES.LIST),
  field("benefits", "Benefits", FIELD_TYPES.LIST),
  field("companyLogo", "Logo", FIELD_TYPES.URL),
  field("companyWebsite", "Website", FIELD_TYPES.URL),
  field("companyProfileUrl", "Company profile", FIELD_TYPES.URL),
  field("companyHq", "Headquarters", FIELD_TYPES.STRING),
  field("companySize", "Employees", FIELD_TYPES.STRING),
  field("companyFounded", "Founded", FIELD_TYPES.STRING),
  field("companySocials", "Socials", FIELD_TYPES.OBJECT),
]);

export const BUILTIN_RUN_VIEW = defineRunView({
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
      "postedAgo",
    ]),
    fieldGroup("company", "Company", [
      "companyName",
      "companyLogo",
      "companyWebsite",
      "companyProfileUrl",
      "companyHq",
      "companySize",
      "companyFounded",
      "companySocials",
    ]),
    fieldGroup("tags", "Tags", ["badges", "industryTags", "benefits"]),
  ],
  components: [RUN_COMPONENT.STEPPER, RUN_COMPONENT.FIELD_GROUPS, RUN_COMPONENT.RESULTS],
  stats: [
    RUN_STAT.CURSOR,
    RUN_STAT.BLOCKS,
    RUN_STAT.HEARTS,
    RUN_STAT.OUTCOMES,
    RUN_STAT.QUEUE,
    RUN_STAT.RECENT_JOBS,
  ],
  settings: [],
});
