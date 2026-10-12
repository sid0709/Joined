import { attrMatch } from "../../routineKit/extract.js";

/** JobRight job board: hosts and Inspector attribute patterns (`index_<name>__<hash>`). */

export const JOBRIGHT_HOSTS = ["jobright.ai"];
export const JOBRIGHT_ORIGIN = "https://jobright.ai";

export const JOB_CARD = [
  attrMatch({
    tag: "div",
    attr: "class",
    pattern: "?job-card-flag-classname?",
  }),
  attrMatch({
    tag: "div",
    attr: "class",
    pattern: "?index_job-card-main__?",
  }),
];
export const JOB_LINK = attrMatch({ tag: "a", attr: "href", pattern: "?/jobs/info/?" });
export const DETAIL_PANE = attrMatch({
  tag: "div",
  attr: "class",
  pattern: "?index_jobdetail-enter__?",
});
export const NOT_INTERESTED_BUTTON = attrMatch({
  tag: "button",
  attr: "id",
  pattern: "index_not-interest-button__?",
});
export const NOT_INTERESTED_CONFIRM =
  "li[class='ant-dropdown-menu-item ant-dropdown-menu-item-only-child']";
export const CLOSE_DETAIL_BUTTON = attrMatch({
  tag: "button",
  attr: "id",
  pattern: "index_job-detail-close-button?",
});

export const NEXT_DATA_SCRIPT = "#__NEXT_DATA__";
export const JSON_LD_SCRIPT = 'script[type="application/ld+json"]';
export const JOB_INFO_PATH = "/jobs/info/";
export const ORIGINAL_POST_LINK = attrMatch({
  tag: "a",
  attr: "class",
  pattern: "?index_origin__?",
});
export const APPLY_BUTTON = "#apply-now-button-id";
export const JOB_TITLE = attrMatch({ tag: "h1", attr: "class", pattern: "?index_job-title__?" });
export const COMPANY_NAME = attrMatch({ attr: "class", pattern: "?index_company-name__?" });
export const COMPANY_ROW = attrMatch({ attr: "class", pattern: "?index_company-row__?" });
export const COMPANY_LOGO = attrMatch({ tag: "img", attr: "alt", pattern: "company-logo" });
export const COMPANY_LINK = attrMatch({
  tag: "a",
  attr: "class",
  pattern: "?index_company-link__?",
});
export const PUBLISH_TIME = attrMatch({ attr: "class", pattern: "?index_publish-time__?" });
export const JOB_TAG = attrMatch({ tag: "span", attr: "class", pattern: "?index_jobTag__?" });
export const EARLY_APPLICANT_TAG = attrMatch({ attr: "class", pattern: "?index_beTag__?" });
export const COMPANY_TAGS = attrMatch({ attr: "class", pattern: "?index_companyTags__?" });
export const SOCIAL_LINK = attrMatch({ tag: "a", attr: "class", pattern: "?index_socialLink__?" });
export const COMPANY_ABOUT = attrMatch({ attr: "class", pattern: "?index_companySummary__?" });
export const JOB_SUMMARY = attrMatch({ attr: "class", pattern: "?index_company-summary__?" });
export const LIST_TEXT = attrMatch({ attr: "class", pattern: "?index_listText__?" });
export const SECTION_LABEL = attrMatch({ tag: "h2", attr: "class", pattern: "?index_label__?" });
export const QUALIFICATION_TAG = attrMatch({
  attr: "class",
  pattern: "?index_qualification-tag__?",
});
export const COMPANY_DATA_LINK = attrMatch({
  attr: "class",
  pattern: "?index_company-data-link__?",
});
export const COMPANY_NAME_HEADING = attrMatch({
  tag: "h2",
  attr: "class",
  pattern: "?index_companyName__?",
});
export const OVERVIEW = "#overview-1";
export const SKILLS_SECTION = "#skills-section";
export const COMPANY_SECTION = "#company";
export const COMPANY_SIZE_ICON = 'svg[aria-label="people size"]';
export const LOCATION_ICON = 'svg[aria-label="position"]';
export const EMPLOYMENT_ICON = 'svg[aria-label="time"]';
export const SALARY_ICON = 'svg[aria-label="money"]';
export const WORK_MODE_ICON = 'svg[aria-label="remote"]';
export const SENIORITY_ICON = 'svg[aria-label="seniority"]';
export const EXPERIENCE_ICON = 'svg[aria-label="date"]';
