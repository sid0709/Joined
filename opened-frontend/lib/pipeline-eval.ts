/**
 * Layer C — Pipeline & evaluation (scaffold) shapes.
 *
 * Einstein contract (persist + return these fields; UI scaffolds against them):
 *
 * GET/PUT /v1/company/jobs/:id/pipeline
 *   body.stages?: PipelineStageDef[]   // custom stages beyond the fixed six
 *   body.feedbackGate?: FeedbackGateConfig
 *   body.scorecardTemplate?: ScorecardTemplate
 *   body.interviewGuide?: InterviewGuide
 *   Fixed six remain: new, screening, interview, offer, hired, rejected.
 *   Custom stage ids must be slug-safe and must not collide with fixed ids.
 *
 * GET /v1/company/jobs/:id  (and list, when cheap)
 *   CompanyJob.customStages?: PipelineStageDef[]
 *   CompanyJob.feedbackGate?: FeedbackGateConfig
 *   CompanyJob.scorecardTemplate?: ScorecardTemplate
 *   CompanyJob.interviewGuide?: InterviewGuide
 *
 * PATCH /v1/company/applicants/:id
 *   body.interviewerIds?: string[]  (team member ids)
 *   body.columnId — reject with 409 when feedbackGate blocks the advance
 *     and required notes / rating / scorecard are missing.
 *
 * POST /v1/company/applicants/:id/scorecards
 *   body: ScorecardSubmissionInput
 *   response: ScorecardSubmission
 *
 * GET /v1/company/applicants/:id/scorecards
 *   ScorecardSubmission[]
 *
 * Out of scope here: SSO, Scoutwell, schedule/Join deep (D). Offers: see offer-hire.ts.
 */

import type { ApplicantStage } from "@/lib/company/applicants";

export const FIXED_PIPELINE_STAGE_IDS = [
  "new",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
] as const;

export type FixedPipelineStageId = (typeof FIXED_PIPELINE_STAGE_IDS)[number];

export type PipelineStageDef = {
  id: string;
  title: string;
  /** Fixed six vs employer-authored. */
  kind: "fixed" | "custom";
  /** When true, advancing INTO this stage requires notes (or scorecard). */
  requiresFeedback?: boolean;
  requiresScorecard?: boolean;
};

export type FeedbackGateConfig = {
  /** Block any forward stage move without team notes. */
  requireNotesOnAdvance: boolean;
  /** Block advance without a rating (1–5). */
  requireRatingOnAdvance: boolean;
  /** Stage ids that additionally require a submitted scorecard. */
  requireScorecardStages: string[];
};

export type ScorecardCriterion = {
  id: string;
  label: string;
  description?: string;
  maxScore: number;
};

export type ScorecardTemplate = {
  id: string;
  name: string;
  criteria: ScorecardCriterion[];
};

export type ScorecardScore = {
  criterionId: string;
  score: number;
  note?: string;
};

export type ScorecardSubmission = {
  id: string;
  applicantId: string;
  interviewId?: string;
  templateId: string;
  scores: ScorecardScore[];
  overall?: number;
  submittedAt: string;
  submittedBy?: string;
};

export type ScorecardSubmissionInput = {
  templateId: string;
  interviewId?: string;
  scores: ScorecardScore[];
  overall?: number;
};

export type InterviewGuideSection = {
  id: string;
  title: string;
  prompts: string[];
};

export type InterviewGuide = {
  id: string;
  title: string;
  sections: InterviewGuideSection[];
};

/** GET/PUT /v1/company/jobs/:id/pipeline body (stages = custom only). */
export type JobPipelineConfig = {
  stages: PipelineStageDef[];
  feedbackGate: FeedbackGateConfig;
  scorecardTemplate?: ScorecardTemplate | null;
  interviewGuide?: InterviewGuide | null;
};

/** Sparse PUT — omit a key to leave it unchanged; null clears template/guide. */
export type JobPipelinePut = {
  stages?: PipelineStageDef[];
  feedbackGate?: FeedbackGateConfig;
  scorecardTemplate?: ScorecardTemplate | null;
  interviewGuide?: InterviewGuide | null;
};

export const MAX_CUSTOM_STAGES = 8;
export const MAX_SCORECARD_CRITERIA = 10;
export const MAX_GUIDE_SECTIONS = 8;
export const MAX_GUIDE_PROMPTS = 6;
export const DEFAULT_CRITERION_MAX = 5;

export const DEFAULT_FEEDBACK_GATE: FeedbackGateConfig = {
  requireNotesOnAdvance: false,
  requireRatingOnAdvance: false,
  requireScorecardStages: [],
};

export function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newCustomStage(partial?: Partial<PipelineStageDef>): PipelineStageDef {
  return {
    id: newId("stage"),
    title: "",
    kind: "custom",
    requiresFeedback: false,
    requiresScorecard: false,
    ...partial,
  };
}

export function newCriterion(partial?: Partial<ScorecardCriterion>): ScorecardCriterion {
  return {
    id: newId("crit"),
    label: "",
    maxScore: DEFAULT_CRITERION_MAX,
    ...partial,
  };
}

export function newScorecardTemplate(partial?: Partial<ScorecardTemplate>): ScorecardTemplate {
  return {
    id: newId("tmpl"),
    name: "Interview scorecard",
    criteria: [
      newCriterion({ label: "Role fit" }),
      newCriterion({ label: "Communication" }),
      newCriterion({ label: "Craft / depth" }),
    ],
    ...partial,
  };
}

export function newGuideSection(partial?: Partial<InterviewGuideSection>): InterviewGuideSection {
  return {
    id: newId("sec"),
    title: "",
    prompts: [""],
    ...partial,
  };
}

export function newInterviewGuide(partial?: Partial<InterviewGuide>): InterviewGuide {
  return {
    id: newId("guide"),
    title: "Interview guide",
    sections: [
      newGuideSection({
        title: "Opening",
        prompts: ["Walk me through a project you owned end to end."],
      }),
      newGuideSection({
        title: "Depth",
        prompts: ["What tradeoffs did you make, and what would you change?"],
      }),
    ],
    ...partial,
  };
}

export function hydrateCustomStages(
  raw: PipelineStageDef[] | undefined | null,
): PipelineStageDef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item.title === "string" && item.kind === "custom")
    .map((item) => ({
      id: item.id || newId("stage"),
      title: item.title.trim(),
      kind: "custom" as const,
      requiresFeedback: Boolean(item.requiresFeedback),
      requiresScorecard: Boolean(item.requiresScorecard),
    }))
    .filter((item) => item.title.length > 0)
    .filter((item) => !(FIXED_PIPELINE_STAGE_IDS as readonly string[]).includes(item.id))
    .slice(0, MAX_CUSTOM_STAGES);
}

export function hydrateFeedbackGate(
  raw: FeedbackGateConfig | undefined | null,
): FeedbackGateConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_FEEDBACK_GATE };
  return {
    requireNotesOnAdvance: Boolean(raw.requireNotesOnAdvance),
    requireRatingOnAdvance: Boolean(raw.requireRatingOnAdvance),
    requireScorecardStages: Array.isArray(raw.requireScorecardStages)
      ? raw.requireScorecardStages.map(String).filter(Boolean)
      : [],
  };
}

export function hydrateScorecardTemplate(
  raw: ScorecardTemplate | undefined | null,
): ScorecardTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const criteria = Array.isArray(raw.criteria)
    ? raw.criteria
        .filter((item) => item && typeof item.label === "string")
        .map((item) => ({
          id: item.id || newId("crit"),
          label: item.label.trim(),
          description: item.description?.trim() || undefined,
          maxScore: item.maxScore > 0 ? item.maxScore : DEFAULT_CRITERION_MAX,
        }))
        .filter((item) => item.label.length > 0)
        .slice(0, MAX_SCORECARD_CRITERIA)
    : [];
  if (criteria.length === 0) return null;
  return {
    id: raw.id || newId("tmpl"),
    name: (raw.name || "Interview scorecard").trim(),
    criteria,
  };
}

export function hydrateInterviewGuide(
  raw: InterviewGuide | undefined | null,
): InterviewGuide | null {
  if (!raw || typeof raw !== "object") return null;
  const sections = Array.isArray(raw.sections)
    ? raw.sections
        .filter((item) => item && typeof item.title === "string")
        .map((item) => ({
          id: item.id || newId("sec"),
          title: item.title.trim(),
          prompts: (Array.isArray(item.prompts) ? item.prompts : [])
            .map((prompt) => String(prompt).trim())
            .filter(Boolean)
            .slice(0, MAX_GUIDE_PROMPTS),
        }))
        .filter((item) => item.title.length > 0)
        .slice(0, MAX_GUIDE_SECTIONS)
    : [];
  if (sections.length === 0) return null;
  return {
    id: raw.id || newId("guide"),
    title: (raw.title || "Interview guide").trim(),
    sections,
  };
}

export function hydrateScorecardSubmission(
  raw: ScorecardSubmission | undefined | null,
): ScorecardSubmission | null {
  if (!raw || typeof raw !== "object" || !raw.id || !raw.applicantId) return null;
  const scores = Array.isArray(raw.scores)
    ? raw.scores
        .filter((item) => item && typeof item.criterionId === "string")
        .map((item) => ({
          criterionId: String(item.criterionId),
          score: typeof item.score === "number" ? item.score : 0,
          note: item.note?.trim() || undefined,
        }))
    : [];
  return {
    id: String(raw.id),
    applicantId: String(raw.applicantId),
    interviewId: raw.interviewId ? String(raw.interviewId) : undefined,
    templateId: String(raw.templateId || ""),
    scores,
    overall: typeof raw.overall === "number" ? raw.overall : undefined,
    submittedAt:
      typeof raw.submittedAt === "string" && raw.submittedAt
        ? raw.submittedAt
        : new Date().toISOString(),
    submittedBy: raw.submittedBy ? String(raw.submittedBy) : undefined,
  };
}

export function hydrateScorecardSubmissions(
  raw: ScorecardSubmission[] | undefined | null,
): ScorecardSubmission[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => hydrateScorecardSubmission(item))
    .filter((item): item is ScorecardSubmission => item != null);
}

export type AdvanceCheckInput = {
  fromStage: string;
  toStage: string;
  notes?: string;
  rating?: number;
  hasScorecard: boolean;
  gate: FeedbackGateConfig;
  customStages?: PipelineStageDef[];
};

export type AdvanceCheckResult = { ok: true } | { ok: false; reason: string };

/** Whether a stage move is allowed under the configured feedback gate. */
export function canAdvanceStage(input: AdvanceCheckInput): AdvanceCheckResult {
  const { fromStage, toStage, gate } = input;
  if (fromStage === toStage) return { ok: true };
  // Moving to rejected never requires feedback/scorecard.
  if (toStage === "rejected") return { ok: true };

  const stageMeta = (input.customStages ?? []).find((stage) => stage.id === toStage);
  const needsNotes = gate.requireNotesOnAdvance || Boolean(stageMeta?.requiresFeedback);
  const needsRating = gate.requireRatingOnAdvance;
  const needsScorecard =
    gate.requireScorecardStages.includes(toStage) || Boolean(stageMeta?.requiresScorecard);

  if (needsNotes && !(input.notes && input.notes.trim().length > 0)) {
    return { ok: false, reason: "Add team notes before advancing this candidate." };
  }
  if (needsRating && !(input.rating && input.rating > 0)) {
    return { ok: false, reason: "Add a team rating before advancing this candidate." };
  }
  if (needsScorecard && !input.hasScorecard) {
    return { ok: false, reason: "Submit a scorecard before advancing to this stage." };
  }
  return { ok: true };
}

/** Merge fixed applicant stages with custom defs for column UIs (scaffold). */
export function mergeStageOptions(
  fixed: { id: ApplicantStage; title: string }[],
  custom: PipelineStageDef[],
): { id: string; title: string }[] {
  const extras = hydrateCustomStages(custom).map((stage) => ({
    id: stage.id,
    title: stage.title,
  }));
  return [...fixed.map((stage) => ({ id: stage.id, title: stage.title })), ...extras];
}
