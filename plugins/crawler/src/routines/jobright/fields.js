import { declareJobFields, field, FIELD_TYPES } from "../../routineKit/declaredFields.js";

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
