import { declareJobFields, field, FIELD_TYPES } from "../../routineKit/declaredFields.js";
import {
  defineRunView,
  fieldGroup,
  RUN_COMPONENT,
  RUN_SETTING,
  RUN_STAT,
} from "../../routineKit/runView.js";

/**
 * Fields Built In actually provides. Skills exist in the DOM on some pages but
 * stay undeclared — the Run view must not show a Skills row. Company website,
 * socials, applicant count, and original post URL are not on the job page.
 */
export const BUILTIN_FIELDS = declareJobFields([
  field("location", "Location", FIELD_TYPES.STRING),
  field("workMode", "Work mode", FIELD_TYPES.STRING),
  field("employmentType", "Employment type", FIELD_TYPES.STRING),
  field("seniority", "Seniority", FIELD_TYPES.STRING),
  field("salary", "Salary", FIELD_TYPES.STRING),
  field("postedAt", "Posted", FIELD_TYPES.DATE),
  field("badges", "Badges", FIELD_TYPES.LIST),
  field("industryTags", "Industry", FIELD_TYPES.LIST),
  field("benefits", "Benefits", FIELD_TYPES.LIST),
  field("companyLogo", "Logo", FIELD_TYPES.URL),
  field("companyHq", "Headquarters", FIELD_TYPES.STRING),
  field("companySize", "Employees", FIELD_TYPES.STRING),
  field("companyFounded", "Founded", FIELD_TYPES.STRING),
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
    ]),
    fieldGroup("company", "Company", [
      "companyName",
      "companyLogo",
      "companyHq",
      "companySize",
      "companyFounded",
    ]),
    fieldGroup("tags", "Tags", ["badges", "industryTags", "benefits"]),
  ],
  components: [
    RUN_COMPONENT.STEPPER,
    RUN_COMPONENT.PACE,
    RUN_COMPONENT.FIELD_GROUPS,
    RUN_COMPONENT.RESULTS,
  ],
  stats: [
    RUN_STAT.JOBS_PER_SECOND,
    RUN_STAT.CONCURRENCY,
    RUN_STAT.BLOCKS,
    RUN_STAT.OUTCOMES,
    RUN_STAT.QUEUE,
    RUN_STAT.RECENT_JOBS,
  ],
  settings: [RUN_SETTING.CONCURRENCY, RUN_SETTING.JOBS_PER_SECOND, RUN_SETTING.FAST_MODE],
});
