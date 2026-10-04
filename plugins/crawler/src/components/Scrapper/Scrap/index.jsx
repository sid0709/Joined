import { useState, useEffect, useRef, useCallback } from "react";
/* global chrome */

import { Button, Divider, CircularProgress, Typography, Paper, Stack, Box } from "@mui/material";

import {
  CheckCircleRounded,
  ErrorRounded,
  PlayArrow,
  RadioButtonUncheckedRounded,
  Stop,
} from "@mui/icons-material";
import PropTypes from "prop-types";
import { useRuntime } from "../../../api/runtimeContext";
import { API_URL, DUPLICATE_WINDOW_DAYS, SCRAPE_SOURCE } from "../../../config/env";
import ScrapeSourceBadge from "../../ScrapeSourceBadge";
import useNotification from "../../../api/useNotification";
import {
  assertCompleteJob,
  getJobValidationChecklist,
  IncompleteJobDataError,
  mergeJobValidationChecklist,
  normalizeOptionalHttpUrl,
} from "../../../api/jobValidation";
import {
  createScrapeRunStats,
  formatElapsedTime,
  getSkippedScrapeCount,
  incrementScrapeRunStats,
  SCRAPE_OUTCOMES,
} from "../../../api/scrapeRunStats";
import {
  clearRememberedPageTab,
  handleClear,
  handleAction,
  handleHighlight,
  rememberActivePageTab,
} from "../../../contentScript/interactionBridge";
import { athensCardSx, athensSectionLabelSx } from "../../../theme/athensTheme";

function CircularProgressWithLabel(props) {
  return (
    <Box sx={{ position: "relative", display: "inline-flex" }}>
      <CircularProgress variant="determinate" {...props} />
      <Box
        sx={{
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
          position: "absolute",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography variant="caption" component="div" sx={{ color: "text.secondary" }}>
          {`${Math.round(props.value)}%`}
        </Typography>
      </Box>
    </Box>
  );
}

CircularProgressWithLabel.propTypes = {
  value: PropTypes.number.isRequired,
};

const pendingValidationChecklist = () => getJobValidationChecklist({}, []);

function ValidationChecklist({ checks }) {
  const validCount = checks.filter(({ status }) => status === "valid").length;
  const invalidCount = checks.filter(({ status }) => status === "invalid").length;

  return (
    <Stack spacing={1.25} sx={{ width: "100%" }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="caption" sx={{ color: "text.primary", fontWeight: 700 }}>
          Field validation
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: invalidCount ? "error.main" : "text.secondary", fontWeight: 600 }}
        >
          {invalidCount ? `${invalidCount} missing` : `${validCount}/${checks.length} valid`}
        </Typography>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 0.75,
        }}
      >
        {checks.map((check, index) => {
          const isValid = check.status === "valid";
          const isInvalid = check.status === "invalid";
          const Icon = isValid
            ? CheckCircleRounded
            : isInvalid
              ? ErrorRounded
              : RadioButtonUncheckedRounded;

          return (
            <Stack
              key={check.id}
              direction="row"
              alignItems="center"
              spacing={0.75}
              sx={{
                minWidth: 0,
                gridColumn:
                  checks.length % 2 === 1 && index === checks.length - 1 ? "1 / -1" : "auto",
                px: 1,
                py: 0.75,
                borderRadius: 1.5,
                bgcolor: "rgba(255, 255, 255, 0.025)",
              }}
            >
              <Icon
                sx={{
                  fontSize: 16,
                  flexShrink: 0,
                  color: isValid ? "success.main" : isInvalid ? "error.main" : "text.secondary",
                }}
              />
              <Typography
                variant="caption"
                noWrap
                title={`${check.label}: ${check.status}`}
                sx={{ color: isInvalid ? "error.main" : "text.secondary", fontWeight: 600 }}
              >
                {check.label}
              </Typography>
            </Stack>
          );
        })}
      </Box>
    </Stack>
  );
}

ValidationChecklist.propTypes = {
  checks: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      status: PropTypes.oneOf(["pending", "valid", "invalid"]).isRequired,
    }),
  ).isRequired,
};

function RunSummary({ elapsedMs, stats, targetTab, queue }) {
  const skipped = getSkippedScrapeCount(stats);
  const totals = [
    { label: "Registered", value: stats.registered, color: "success.main" },
    { label: "Skipped", value: skipped, color: "warning.main" },
    { label: "Failed", value: stats.failed, color: "error.main" },
    { label: "Queued", value: queue.queued, color: "info.light" },
    { label: "Saving", value: queue.saving, color: "primary.light" },
  ];

  return (
    <Stack spacing={1.25} sx={{ width: "100%" }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="caption" sx={{ color: "text.primary", fontWeight: 700 }}>
          Run results
        </Typography>
        <Typography variant="caption" sx={{ color: "primary.light", fontWeight: 700 }}>
          {formatElapsedTime(elapsedMs)}
        </Typography>
      </Stack>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 0.75 }}>
        {totals.map(({ label, value, color }) => (
          <Box
            key={label}
            sx={{
              px: 0.75,
              py: 1,
              textAlign: "center",
              borderRadius: 1.5,
              bgcolor: "rgba(255, 255, 255, 0.025)",
            }}
          >
            <Typography sx={{ color, fontSize: "1rem", fontWeight: 800, lineHeight: 1.1 }}>
              {value}
            </Typography>
            <Typography sx={{ color: "text.secondary", fontSize: "0.625rem", fontWeight: 700 }}>
              {label}
            </Typography>
          </Box>
        ))}
      </Box>
      <Typography variant="caption" sx={{ color: "text.secondary", textAlign: "center" }}>
        Duplicates {stats.duplicate} · Validation {stats.validation} · Blocked {stats.blocked}
      </Typography>
      {targetTab && (
        <Typography
          variant="caption"
          noWrap
          title={targetTab.url}
          sx={{ color: "text.secondary", textAlign: "center" }}
        >
          Target tab #{targetTab.id}: {targetTab.title || new URL(targetTab.url).hostname}
        </Typography>
      )}
    </Stack>
  );
}

RunSummary.propTypes = {
  elapsedMs: PropTypes.number.isRequired,
  stats: PropTypes.shape({
    registered: PropTypes.number.isRequired,
    duplicate: PropTypes.number.isRequired,
    validation: PropTypes.number.isRequired,
    blocked: PropTypes.number.isRequired,
    failed: PropTypes.number.isRequired,
  }).isRequired,
  targetTab: PropTypes.shape({
    id: PropTypes.number.isRequired,
    title: PropTypes.string.isRequired,
    url: PropTypes.string.isRequired,
  }),
  queue: PropTypes.shape({
    queued: PropTypes.number.isRequired,
    saving: PropTypes.number.isRequired,
  }).isRequired,
};

const ScrapComponent = () => {
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const [progress, setProgress] = useState(0);
  const [scrapFlag, setScrapFlag] = useState(false);
  const [validationChecks, setValidationChecks] = useState(pendingValidationChecklist);
  const [runStats, setRunStats] = useState(createScrapeRunStats);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [starting, setStarting] = useState(false);
  const [targetTab, setTargetTab] = useState(null);
  const [queueCounts, setQueueCounts] = useState({ queued: 0, saving: 0 });

  const { addListener, removeListener } = useRuntime();
  const notification = useNotification();
  const pendingResolvers = useRef(new Map());
  const runStartedAt = useRef(null);
  const runIdRef = useRef(null);
  const scrapActiveRef = useRef(false);

  const fetchFromPage = useCallback((tag, property, pattern) => {
    const id = `scrap_wait_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const promise = new Promise((resolve) => pendingResolvers.current.set(id, resolve));
    handleAction(tag, property, pattern, 0, "fetch", null, "content", id);
    return promise;
  }, []);

  const sendRuntimeMessage = useCallback(
    (message) =>
      new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else if (response?.success === false)
            reject(new Error(response.error || "Background request failed"));
          else resolve(response);
        });
      }),
    [],
  );

  const notifyFailure = useCallback(
    (err, fallback) => {
      notification.fail(err, { key: "scrap-failure", autoHideDuration: 2200 });
      if (fallback) console.error(fallback, err);
    },
    [notification],
  );

  const completeValidation = useCallback((ruleIds, partialJob) => {
    setValidationChecks((current) => mergeJobValidationChecklist(current, partialJob, ruleIds));
  }, []);

  const recordOutcome = useCallback(
    (outcome) => {
      setRunStats((current) => incrementScrapeRunStats(current, outcome));
      if (runIdRef.current) {
        void sendRuntimeMessage({
          action: "scrapeQueue:recordOutcome",
          payload: { runId: runIdRef.current, outcome },
        }).catch((error) => console.error("Failed to persist scrape outcome", error));
      }
    },
    [sendRuntimeMessage],
  );

  useEffect(() => {
    const listener = (message) => {
      if (message?.action === "fetchResult") {
        const id = message.payload?.identifier;
        const resolver = id ? pendingResolvers.current.get(id) : null;
        if (id) {
          if (resolver) {
            resolver(message.payload);
            pendingResolvers.current.delete(id);
          }
        }
      }
      if (message?.action === "scrapeQueue:state") {
        const state = message.payload;
        if (!state?.runId || (runIdRef.current && state.runId !== runIdRef.current)) return;
        if (!runIdRef.current) runIdRef.current = state.runId;
        setQueueCounts(state.counts || { queued: 0, saving: 0 });
        if (state.summary) setRunStats({ ...createScrapeRunStats(), ...state.summary });
      }
      if (
        message?.action === "scrapeQueue:itemResult" &&
        message.payload?.runId === runIdRef.current
      ) {
        const outcome = message.payload.outcome;
        if (outcome === SCRAPE_OUTCOMES.REGISTERED) {
          notification.success("Job registered successfully", {
            key: "scrap-outcome",
            autoHideDuration: 1200,
          });
        } else if (outcome === SCRAPE_OUTCOMES.DUPLICATE) {
          notification.info(message.payload.result?.reason || "Duplicate job skipped", {
            key: "scrap-outcome",
            autoHideDuration: 1200,
          });
        } else if (outcome === SCRAPE_OUTCOMES.BLOCKED) {
          notification.warning(message.payload.result?.reason || "Job skipped by a blocking rule", {
            key: "scrap-outcome",
            autoHideDuration: 1500,
          });
        } else {
          notifyFailure(
            new Error(
              message.payload.error || message.payload.result?.error || "Failed to register job",
            ),
          );
        }
      }
    };
    addListener(listener);
    void sendRuntimeMessage({ action: "scrapeQueue:getState" })
      .then((response) => listener({ action: "scrapeQueue:state", payload: response?.state }))
      .catch((error) => console.error("Failed to restore scrape queue state", error));
    return () => removeListener(listener);
  }, [addListener, removeListener, notification, notifyFailure, sendRuntimeMessage]);

  useEffect(() => {
    if (!scrapFlag || !runStartedAt.current) return undefined;
    const updateElapsed = () => setElapsedMs(Date.now() - runStartedAt.current);
    updateElapsed();
    const interval = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(interval);
  }, [scrapFlag]);

  async function onClickListItem() {
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
    const promise_job_metadata = new Promise((resolve) =>
      pendingResolvers.current.set(id, resolve),
    );
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
    handleAction(
      "div",
      "class",
      "?index_skill-matching-tags-area__?",
      0,
      "fetch",
      null,
      "text",
      id,
    );
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
    const promise_company_link = new Promise((resolve) =>
      pendingResolvers.current.set(id, resolve),
    );
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

  useEffect(() => {
    let active = true;

    const run = async () => {
      while (active && scrapFlag) {
        try {
          await onClickListItem();
        } catch (err) {
          console.log("error:[on clicked] ", err);
          if (err instanceof IncompleteJobDataError) {
            recordOutcome(SCRAPE_OUTCOMES.VALIDATION);
            console.warn("Skipping job with invalid data", err.issues);
            setProgress(0);
            handleClear();
            continue;
          }
          recordOutcome(SCRAPE_OUTCOMES.FAILED);
          notifyFailure(err, "Error in scrape loop");
        }
      }
    };

    if (scrapFlag) {
      run();
    }

    return () => {
      active = false;
    };
  }, [scrapFlag, notifyFailure, recordOutcome]);

  const onScrapStart = async () => {
    if (!API_URL) {
      notifyFailure(new Error("API base URL is not configured"));
      return;
    }
    if (!DUPLICATE_WINDOW_DAYS) {
      notifyFailure(
        new Error(
          "VITE_DUPLICATE_WINDOW_DAYS must be a whole number from 1 to 365 in Extension/.env.",
        ),
      );
      return;
    }
    setStarting(true);
    scrapActiveRef.current = true;
    try {
      const rememberedTab = await rememberActivePageTab();
      if (!rememberedTab) {
        throw new Error("Focus the job scraping website, then click Start again.");
      }
      setTargetTab(rememberedTab);
      runIdRef.current =
        globalThis.crypto?.randomUUID?.() ||
        `run-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      // Drop leftover queue items from earlier failed retries (delayed nextAttemptAt).
      await sendRuntimeMessage({ action: "scrapeQueue:clear" }).catch(() => {});
      setRunStats(createScrapeRunStats());
      setQueueCounts({ queued: 0, saving: 0 });
      setValidationChecks(pendingValidationChecklist());
      setProgress(0);
      setElapsedMs(0);
      runStartedAt.current = Date.now();
      setScrapFlag(true);
    } catch (error) {
      scrapActiveRef.current = false;
      clearRememberedPageTab();
      notifyFailure(error, "Unable to remember the scraping tab");
    } finally {
      setStarting(false);
    }
  };

  const onScrapStop = () => {
    scrapActiveRef.current = false;
    if (runStartedAt.current) {
      setElapsedMs(Date.now() - runStartedAt.current);
      runStartedAt.current = null;
    }
    clearRememberedPageTab();
    setScrapFlag(false);
    setProgress(0);
    setValidationChecks(pendingValidationChecklist());
  };

  return (
    <Paper sx={{ ...athensCardSx, mx: "auto" }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography sx={athensSectionLabelSx} component="p" gutterBottom>
            Automation
          </Typography>
          <Typography variant="h5" component="h2">
            Scraping Controls
          </Typography>
          <Box sx={{ mt: 1.25 }}>
            <ScrapeSourceBadge />
          </Box>
        </Box>
        <Divider />

        <Stack
          spacing={2}
          alignItems="center"
          sx={{
            p: 2,
            borderRadius: 3,
            bgcolor: "secondary.main",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <CircularProgressWithLabel size={72} value={progress} thickness={4} />
          <ValidationChecklist checks={validationChecks} />
          <Divider flexItem />
          <RunSummary
            elapsedMs={elapsedMs}
            stats={runStats}
            targetTab={targetTab}
            queue={queueCounts}
          />
        </Stack>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            color="error"
            onClick={onScrapStop}
            disabled={!scrapFlag}
            startIcon={<Stop />}
            fullWidth
          >
            Stop
          </Button>
          <Button
            variant="contained"
            onClick={onScrapStart}
            disabled={scrapFlag || starting}
            startIcon={<PlayArrow />}
            fullWidth
          >
            {starting ? "Remembering…" : "Start"}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
};

export default ScrapComponent;
