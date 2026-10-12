import { declareJobFields, field, FIELD_TYPES } from "../../routineKit/declaredFields.js";
import { defineRunView, fieldGroup, RUN_COMPONENT, RUN_STAT } from "../../routineKit/runView.js";

/** Fields JobRight actually shows on a job (JSON first, DOM fallback). */
export const JOBRIGHT_FIELDS = declareJobFields([
  field("location", "Location", FIELD_TYPES.STRING),
  field("workMode", "Work mode", FIELD_TYPES.STRING),
  field("employmentType", "Employment type", FIELD_TYPES.STRING),
  field("seniority", "Seniority", FIELD_TYPES.STRING),
  field("yearsOfExperience", "Experience", FIELD_TYPES.STRING),
  field("salary", "Salary", FIELD_TYPES.STRING),
  field("postedAt", "Posted", FIELD_TYPES.DATE),
  field("applicantCount", "Applicants", FIELD_TYPES.NUMBER),
  field("badges", "Badges", FIELD_TYPES.LIST),
  field("industryTags", "Industry", FIELD_TYPES.LIST),
  field("benefits", "Benefits", FIELD_TYPES.LIST),
  field("skills", "Skills", FIELD_TYPES.LIST),
  field("descriptionSections", "Description sections", FIELD_TYPES.OBJECT),
  field("originalPostUrl", "Original post", FIELD_TYPES.URL),
  field("companyLogo", "Logo", FIELD_TYPES.URL),
  field("companyWebsite", "Website", FIELD_TYPES.URL),
  field("companySize", "Company size", FIELD_TYPES.STRING),
  field("companyHq", "Headquarters", FIELD_TYPES.STRING),
  field("companyFounded", "Founded", FIELD_TYPES.STRING),
  field("companyAbout", "About", FIELD_TYPES.STRING),
  field("companySocial", "Social", FIELD_TYPES.OBJECT),
]);

export const JOBRIGHT_RUN_VIEW = defineRunView({
  groups: [
    fieldGroup("job", "Job", [
      "applyUrl",
      "title",
      "description",
      "location",
      "workMode",
      "employmentType",
      "seniority",
      "yearsOfExperience",
      "salary",
      "postedAt",
      "originalPostUrl",
      "applicantCount",
    ]),
    fieldGroup("company", "Company", [
      "companyName",
      "companyLogo",
      "companyWebsite",
      "companySize",
      "companyHq",
      "companyFounded",
      "companyAbout",
      "companySocial",
    ]),
    fieldGroup("skills", "Skills", ["skills"]),
    fieldGroup("tags", "Tags", ["badges", "industryTags", "benefits"]),
    fieldGroup("sections", "Description", ["descriptionSections"]),
  ],
  components: [RUN_COMPONENT.STEPPER, RUN_COMPONENT.FIELD_GROUPS, RUN_COMPONENT.RESULTS],
  stats: [RUN_STAT.OUTCOMES, RUN_STAT.QUEUE, RUN_STAT.RECENT_JOBS],
  settings: [],
});
