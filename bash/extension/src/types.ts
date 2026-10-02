export interface DomNode {
  nodeId: number;
  tag: string;
  id?: string;
  classes?: string[];
  attrs?: Record<string, string>;
  text?: string;
  childCount: number;
  children: DomNode[];
}

export interface DomTreePayload {
  url: string;
  title: string;
  tree: DomNode;
  fetchedAt: string;
  tabId?: number;
  frameId?: number;
  /** Fillable control count used to pick the form frame among iframes. */
  formScore?: number;
}

/** @deprecated use DEFAULT_ATHENS_API_URL from auth/oak-auth */
export const DEFAULT_SERVER = "https://athensai.remotepairnet.net";
/** @deprecated same host as athens-backend */
export const DEFAULT_AI_SERVER = "https://athensai.remotepairnet.net";

/** Long-lived side-panel port. Keeps the MV3 worker (and `/oak` socket) alive. */
export const OAK_SIDEBAR_PORT = "oak-sidebar";

export const MSG = {
  FETCH_DOM: "oak:fetch-dom",
  FETCH_AND_EMIT_DOM: "oak:fetch-and-emit-dom",
  HIGHLIGHT: "oak:highlight",
  CLEAR_HIGHLIGHT: "oak:clear-highlight",
  GET_CONTENT: "oak:get-content",
  EXECUTE_ACTIONS: "oak:execute-actions",
  PLAN_STEP: "oak:plan-step",
  MATCH_OPTION: "oak:match-option",
  FILL_LEFTOVER_COMBOS: "oak:fill-leftover-combos",
  START_PIPELINE: "oak:start-pipeline",
  PIPELINE_PROGRESS: "oak:pipeline-progress",
  SOCKET_STATUS: "oak:socket-status",
  OPERATOR_NOTICE: "oak:operator-notice",
  AUTH_STATUS: "oak:auth-status",
  AUTH_SIGNIN: "oak:auth-signin",
  AUTH_SIGNOUT: "oak:auth-signout",
  LIST_WORKER_JOBS: "oak:list-worker-jobs",
  OPEN_WORKER_JOB: "oak:open-worker-job",
  MARK_JOB_APPLIED: "oak:mark-job-applied",
  GET_TAB_JOB: "oak:get-tab-job",
  REMEMBER_CUSTOM_TAB: "oak:remember-custom-tab",
  FORGET_CUSTOM_TAB: "oak:forget-custom-tab",
  FOCUS_CUSTOM_TAB: "oak:focus-custom-tab",
  START_CUSTOM_GENERATE: "oak:start-custom-generate",
  START_CUSTOM_RECOMMEND: "oak:start-custom-recommend",
  START_JOB_GENERATE: "oak:start-job-generate",
  START_JOB_RECOMMEND: "oak:start-job-recommend",
  SELECTION_QA: "oak:selection-qa",
} as const;

export type OakNoticeKind = "error" | "success" | "info";

export type OakNoticePayload = {
  kind: OakNoticeKind;
  title: string;
  detail?: string;
};

export type PipelineSource = "fill" | "custom";

export interface MatchOptionRequest {
  intendedValue: string;
  options: string[];
  fieldLabel?: string | null;
  typedQuery?: string | null;
}

export interface MatchOptionResponse {
  ok?: boolean;
  matched_option?: string | null;
  confidence?: number;
  reason?: string;
  error?: string;
  model?: string;
  usage?: import("../../shared/ai-usage").AiUsageSummary;
}

export type PlanStepActionType =
  "fill" | "upload" | "resume_upload" | "select_radio" | "wait" | "validate" | "verify_only";

export interface RuntimeAttachedFile {
  key: string;
  name: string;
  mimeType: string;
  base64: string;
  label?: string | null;
  resumeId?: string | null;
  jobId?: string | null;
}

export interface PlanStepPayload {
  action: PlanStepActionType;
  element_index: number | null;
  element_indexes: number[] | null;
  expected_label: string | null;
  expected_role: string | null;
  value: string | null;
  file?: RuntimeAttachedFile | null;
  ms: number | null;
}

export interface PlanStepSocketPayload {
  tabId: number;
  url: string;
  extensionId?: string;
  frameId?: number | null;
  step: PlanStepPayload;
}

export interface PlanStepResult {
  ok: boolean;
  verified?: boolean;
  acted?: boolean;
  /** True when the control already had the intended value (do not confuse with frame `skipped`). */
  alreadyFilled?: boolean;
  error?: string;
  details?: {
    nodeId?: number;
    matchedLabel?: string;
    matchedRole?: string;
    valueAfter?: string;
  };
}

export interface HighlightPayload {
  nodeId: number;
  tabId: number;
  url: string;
}

export interface GetContentPayload {
  nodeId: number;
  tabId: number;
  contentType: "innerHTML" | "innerText";
}

export interface ActionStep {
  type: "focus" | "click" | "type" | "wait" | "keydown" | "keyup";
  text?: string;
  ms?: number;
  key?: string;
}

export interface ExecuteActionsPayload {
  nodeId: number;
  tabId: number;
  steps: ActionStep[];
}

export type SelectionQaResponse = {
  ok: boolean;
  answer?: string;
  error?: string;
};
