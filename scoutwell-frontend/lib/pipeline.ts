import { LEVELS, SCAM_KEYWORDS, SUMMARY_COPY_CHARS, SUMMARY_MIN_CHARS } from "./config";
import { precheckUrl } from "./precheck";
import type {
  AutoCheckResult,
  CheckOutcome,
  ScoutAccount,
  Submission,
  SubmissionStatus,
} from "./types";

export type PipelineDecision = {
  status: SubmissionStatus;
  rejectionReason: string;
  hiddenJob: boolean;
  alreadyOnMajorBoards: boolean;
  autoCheckResults: AutoCheckResult[];
};

function check(id: string, label: string, outcome: CheckOutcome, detail: string): AutoCheckResult {
  return { id, label, outcome, detail };
}

function scamText(value: string) {
  const haystack = value.toLowerCase();
  return SCAM_KEYWORDS.find((keyword) => haystack.includes(keyword)) ?? null;
}

export function evaluateSubmission(
  input: {
    url: string;
    companyName: string;
    title: string;
    summary: string;
  },
  account: Pick<ScoutAccount, "level">,
  existing: Pick<Submission, "id" | "canonicalUrl" | "status">[],
): PipelineDecision {
  const precheck = precheckUrl(input.url, existing);
  const results: AutoCheckResult[] = [];
  const scam = scamText(`${input.summary} ${input.title} ${input.companyName}`);

  results.push(
    check(
      "reachable",
      "URL reachable",
      precheck.reachable ? "pass" : "fail",
      precheck.reachable ? precheck.host : precheck.reason,
    ),
  );
  results.push(
    check("official", "Official source", precheck.official ? "pass" : "fail", precheck.reason),
  );
  results.push(
    check(
      "duplicate",
      "Duplicate",
      precheck.duplicateOf ? "fail" : "pass",
      precheck.duplicateOf ? `Matches ${precheck.duplicateOf}` : "No active match",
    ),
  );

  const alreadyOnMajorBoards = /\b(linkedin|indeed)\b/i.test(input.summary);
  results.push(
    check(
      "major-boards",
      "Already on major boards",
      alreadyOnMajorBoards ? "flag" : "pass",
      alreadyOnMajorBoards
        ? "Found on a major board — allowed, lower approval reward, no hidden badge"
        : "Not found on LinkedIn or Indeed",
    ),
  );

  if (scam) {
    results.push(check("scam", "Scam heuristics", "fail", `Flagged language: ${scam}`));
  } else {
    results.push(
      check("scam", "Scam heuristics", "pass", "No payment-request or off-platform chat markers"),
    );
  }

  const summary = input.summary.trim();
  if (summary.length < SUMMARY_MIN_CHARS) {
    results.push(
      check("content", "Content", "review", "Summary is too short to be the scout's own words"),
    );
  } else if (summary.length >= SUMMARY_COPY_CHARS) {
    results.push(
      check("content", "Content", "review", "Summary looks copied from the source page"),
    );
  } else {
    results.push(check("content", "Content", "pass", "Summary looks original"));
  }

  const failed = results.find((item) => item.outcome === "fail");
  if (!precheck.official) {
    return {
      status: "rejected",
      rejectionReason: "not an official source",
      hiddenJob: false,
      alreadyOnMajorBoards,
      autoCheckResults: results,
    };
  }
  if (precheck.duplicateOf) {
    return {
      status: "duplicate",
      rejectionReason: "duplicate",
      hiddenJob: false,
      alreadyOnMajorBoards,
      autoCheckResults: results,
    };
  }
  if (failed) {
    return {
      status: "rejected",
      rejectionReason: failed.detail,
      hiddenJob: false,
      alreadyOnMajorBoards,
      autoCheckResults: results,
    };
  }

  const needsReview =
    results.some((item) => item.outcome === "review") || !LEVELS[account.level].autoApprove;
  return {
    status: needsReview ? "needs_review" : "approved",
    rejectionReason: "",
    hiddenJob: !alreadyOnMajorBoards,
    alreadyOnMajorBoards,
    autoCheckResults: results,
  };
}
