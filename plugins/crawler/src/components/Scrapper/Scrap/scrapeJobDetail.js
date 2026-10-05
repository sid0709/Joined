import {
  assertCompleteJob,
  getJobValidationChecklist,
  normalizeOptionalHttpUrl,
} from "../../../api/jobValidation";
import { DUPLICATE_WINDOW_DAYS, SCRAPE_SOURCE } from "../../../config/env";
import {
  handleAction,
  handleClear,
  handleHighlight,
} from "../../../contentScript/interactionBridge";

export const pendingValidationChecklist = () => getJobValidationChecklist({}, []);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** One pass of the scrape loop: open the next job card, read it, enqueue it, close it. */
// eslint-disable-next-line complexity -- one linear scrape sequence; splitting it is a behavior change
export async function scrapeJobDetail({
  setProgress,
  setValidationChecks,
  completeValidation,
  pendingResolvers,
  sendRuntimeMessage,
  fetchFromPage,
  runIdRef,
  scrapActiveRef,
  notification,
}) {
  setValidationChecks(pendingValidationChecklist());
  handleClear();
  handleHighlight("div", "class", "?index_job-card-main?");
  handleAction("a", "href", "?jobs/info/?", 0, "click", "");
  await delay(250);
  handleClear();
  setProgress(10);

  handleClear();

  let id = `scrap_wait_for_details_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const promise_waitfor_jobdetails = new Promise((resolve) =>
    pendingResolvers.current.set(id, resolve),
  );
  handleAction("div", "class", "?index_jobdetail-enter?", 0, "fetch", null, "text", id);
  await promise_waitfor_jobdetails;
  await delay(250);

  handleHighlight("img", "class", "?index_company-logo-img__?");
  id = `scrap_logo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const promise_logo = new Promise((resolve) => pendingResolvers.current.set(id, resolve));
  handleAction("img", "class", "?index_company-logo-img__?", 0, "fetch", null, "src", id);
  const CompanyLogoComponent = await promise_logo;
  const CompanyLogo = CompanyLogoComponent?.success
    ? new DOMParser().parseFromString(CompanyLogoComponent.data, "text/html").querySelector("img")
        ?.src
    : null;
  completeValidation(["companyLogo"], { company: { logo: CompanyLogo || "" } });
  handleClear();
  setProgress(12);
  await delay(100);
  handleClear();

  handleHighlight("a", "class", "?index_origin__?");
  id = `scrap_apply_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const promise_applyLink = new Promise((resolve) => pendingResolvers.current.set(id, resolve));
  handleAction("a", "class", "?index_origin__?", 0, "fetch", null, "content", id);
  const LinkComponent = await promise_applyLink;

  const ApplyLink = LinkComponent?.success
    ? new DOMParser().parseFromString(LinkComponent.data, "text/html").querySelector("a")?.href
    : null;
  completeValidation(["applyLink"], { applyLink: ApplyLink || "" });
  setProgress(15);
  await delay(100);
  handleClear();

  handleHighlight("div", "class", "?index_jobTag__?");
  id = `scrap_applicants_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const promise_jobTag = new Promise((resolve) => pendingResolvers.current.set(id, resolve));
  handleAction("div", "class", "?index_jobTag__?", 0, "fetch", null, "text", id);
  const ApplicantsNumber = await promise_jobTag;
  const parsedTags = ApplicantsNumber?.success
    ? ApplicantsNumber.data
        .split("\n")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];
  completeValidation(["tags"], { tags: parsedTags });
  setProgress(20);
  await delay(100);
  handleClear();

  handleHighlight("h2", "class", "?index_company-row__?");
  id = `scrap_company_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const promise_companyRow = new Promise((resolve) => pendingResolvers.current.set(id, resolve));
  handleAction("h2", "class", "?index_company-row__?", 0, "fetch", null, "content", id);
  const CompanyRawComponent = await promise_companyRow;
  let CompanyName = null;
  let PublishTime = null;

  if (CompanyRawComponent?.success) {
    const doc = new DOMParser().parseFromString(CompanyRawComponent.data, "text/html");
    const spans = doc.querySelectorAll("span");

    CompanyName = spans[0]?.innerText || null;
    PublishTime = spans[1]?.innerText.replace(" · ", "") || null;
  }
  completeValidation(["companyName", "postedAgo"], {
    company: { name: CompanyName || "" },
    postedAgo: PublishTime || "",
  });

  setProgress(25);
  await delay(100);
  handleClear();

  handleHighlight("h1", "class", "?index_job-title__?");
  id = `scrap_title_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const promise_jobTitle = new Promise((resolve) => pendingResolvers.current.set(id, resolve));
  handleAction("h1", "class", "?index_job-title__?", 0, "fetch", null, "text", id);
  const JobTitle = await promise_jobTitle;
  completeValidation(["title"], { title: JobTitle?.success ? JobTitle.data : "" });
  setProgress(30);
  await delay(100);
  handleClear();

  handleHighlight("div", "class", "?index_job-metadata-row__?");
  id = `scrap_meta_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const promise_job_metadata = new Promise((resolve) => pendingResolvers.current.set(id, resolve));
  handleAction("div", "class", "?index_job-metadata-row__?", 0, "fetch", null, "content", id);

  const MetaTagsComponent = await promise_job_metadata;
  const MetaTags = (() => {
    if (!MetaTagsComponent?.success || !MetaTagsComponent?.data) return {};
    const doc = new DOMParser().parseFromString(MetaTagsComponent.data, "text/html");
    const items = doc.querySelectorAll('div[class*="index_job-metadata-item__"]');
    return Array.from(items).reduce((acc, div) => {
      const key = div.querySelector("img")?.getAttribute("alt");
      const value = div.querySelector("span")?.textContent?.trim();
      if (key && value) acc[key] = value;
      return acc;
    }, {});
  })();
  completeValidation(["details"], { details: MetaTags });
  setProgress(35);
  await delay(100);
  handleClear();

  handleHighlight("div", "class", "?index_company-summary__?");
  id = `scrap_summary_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const promise_company_summary = new Promise((resolve) =>
    pendingResolvers.current.set(id, resolve),
  );
  handleAction("div", "class", "?index_company-summary__?", 0, "fetch", null, "text", id);
  const CompanySummary = await promise_company_summary;
  setProgress(40);
  await delay(100);
  handleClear();

  handleHighlight("div", "class", "?index_companyTags?");
  id = `scrap_tags_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const promise_companyTags = new Promise((resolve) => pendingResolvers.current.set(id, resolve));
  handleAction("div", "class", "?index_companyTags?", 0, "fetch", null, "content", id);
  const CompanyTagsComponent = await promise_companyTags;
  const CompanyTags = CompanyTagsComponent?.success
    ? Array.from(
        new DOMParser()
          .parseFromString(CompanyTagsComponent.data, "text/html")
          .querySelectorAll("span.ant-tag"),
      ).map((span) => span.innerText)
    : [];
  completeValidation(["companyTags"], { company: { tags: CompanyTags } });
  setProgress(45);
  await delay(100);
  handleClear();

  handleHighlight("section", "class", "?index_sectionContent__?");
  id = `scrap_resp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const promise_sectionContent1 = new Promise((resolve) =>
    pendingResolvers.current.set(id, resolve),
  );
  handleAction("section", "class", "?index_sectionContent__?", 2, "fetch", null, "text", id);
  const Responsibilities = await promise_sectionContent1;
  setProgress(50);
  await delay(100);
  handleClear();

  handleHighlight("section", "class", "?index_sectionContent__?");
  id = `scrap_qual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const promise_sectionContent2 = new Promise((resolve) =>
    pendingResolvers.current.set(id, resolve),
  );
  handleAction("section", "class", "?index_sectionContent__?", 3, "fetch", null, "text", id);
  const Qualification = await promise_sectionContent2;
  setProgress(55);
  await delay(100);
  handleClear();

  handleHighlight("section", "class", "?index_sectionContent__?");
  id = `scrap_ben_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const promise_sectionContent3 = new Promise((resolve) =>
    pendingResolvers.current.set(id, resolve),
  );
  handleAction("section", "class", "?index_sectionContent__?", 4, "fetch", null, "text", id);
  const Benefits = await promise_sectionContent3;
  const Description = [
    Responsibilities?.success ? Responsibilities.data : "",
    Qualification?.success ? Qualification.data : "",
    Benefits?.success ? Benefits.data : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  completeValidation(["description"], { description: Description });
  setProgress(60);
  await delay(100);
  handleClear();

  handleHighlight("div", "class", "?index_skill-matching-tags-area__?");
  id = `scrap_skill_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const promise_skill_matching = new Promise((resolve) =>
    pendingResolvers.current.set(id, resolve),
  );
  handleAction("div", "class", "?index_skill-matching-tags-area__?", 0, "fetch", null, "text", id);
  const SkillMatching = await promise_skill_matching;
  const Skills = SkillMatching?.success
    ? SkillMatching.data
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  completeValidation(["skills"], { skills: Skills });
  setProgress(65);
  handleClear();
  await delay(250);
  setProgress(70);

  handleHighlight("a", "class", "index_company-link?");
  id = `scrap_company_link_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const promise_company_link = new Promise((resolve) => pendingResolvers.current.set(id, resolve));
  handleAction("a", "class", "index_company-link?", 0, "fetch", null, "content", id);
  const CompanyLink = await promise_company_link;
  // Mirror ApplyLink: fetch the anchor's HTML and read its href so we store
  // the company URL, not the link text.
  const CompanyLinkUrl = normalizeOptionalHttpUrl(
    CompanyLink?.success
      ? new DOMParser().parseFromString(CompanyLink.data, "text/html").querySelector("a")?.href ||
          ""
      : "",
  );
  completeValidation(["companyLink"], { companyLink: CompanyLinkUrl });
  setProgress(75);
  handleClear();
  await delay(250);
  setProgress(75);

  const resultData = {
    createdBy: SCRAPE_SOURCE,
    applyLink: ApplyLink || "",
    id: Date.now(),
    duplicateWindowDays: DUPLICATE_WINDOW_DAYS,
    postedAgo: PublishTime || "",
    tags: parsedTags,
    company: {
      name: CompanyName || "",
      tags: CompanyTags || [],
      logo: CompanyLogoComponent?.success ? CompanyLogo || "" : "",
    },
    title: JobTitle?.success ? JobTitle.data : "",
    details: MetaTags || {},
    applicants: ApplicantsNumber?.success
      ? {
          count: parseInt(ApplicantsNumber.data.match(/\d+/)?.[0] || "0", 10),
          text: ApplicantsNumber.data,
        }
      : { count: 0, text: "" },
    description: Description,
    skills: Skills || [],
    companyLink: CompanyLinkUrl,
  };

  console.log("Scraped job data:", resultData);
  if (ApplyLink) {
    setValidationChecks(getJobValidationChecklist(resultData));
    assertCompleteJob(resultData);
  }
  // Fire-and-forget: the scrape loop must not block on the background
  // script acking storage/backend work, or a slow drain/backend stalls scraping.
  sendRuntimeMessage({
    action: "scrapeQueue:enqueue",
    payload: { runId: runIdRef.current, job: resultData },
  }).catch((error) => console.error("Failed to enqueue scraped job", error));
  setProgress(80);

  handleHighlight("button", "id", "index_not-interest-button__?");
  handleAction("button", "id", "index_not-interest-button__?", 0, "click", "");
  await delay(250);
  setProgress(85);

  handleHighlight("li", "class", "ant-dropdown-menu-item ant-dropdown-menu-item-only-child");
  handleAction(
    "li",
    "class",
    "ant-dropdown-menu-item ant-dropdown-menu-item-only-child",
    0,
    "click",
    "",
  );
  await delay(250);
  setProgress(90);

  /*
		Click Close logo button
		*/
  handleHighlight("button", "id", "index_job-detail-close-button?");
  handleAction("button", "id", "index_job-detail-close-button?", 0, "click", "");
  await delay(250);
  setProgress(95);

  const detailCloseDeadline = Date.now() + 8000;
  let detailCloseReason = "timeout";
  while (scrapActiveRef.current && Date.now() < detailCloseDeadline) {
    const detailOpen = await fetchFromPage("div", "class", "?index_jobdetail-enter?");
    if (!detailOpen?.success) {
      detailCloseReason = "closed";
      break;
    }
    await delay(400);
  }
  if (!scrapActiveRef.current) detailCloseReason = "stopped";
  if (!scrapActiveRef.current) return;

  notification.info(`Job detail closed (${detailCloseReason})`, {
    key: "scrap-close",
    autoHideDuration: 1200,
  });

  setProgress(100);
  handleClear();
  await delay(100);
  setProgress(0);
  await delay(150);
}
