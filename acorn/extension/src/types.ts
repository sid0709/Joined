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

/** Long-lived side-panel port. Keeps the MV3 worker (and `/bash/socket.io` socket) alive. */
export const BASH_SIDEBAR_PORT = "bash-sidebar";

export const MSG = {
  FETCH_DOM: "bash:fetch-dom",
  FETCH_AND_EMIT_DOM: "bash:fetch-and-emit-dom",
  HIGHLIGHT: "bash:highlight",
  CLEAR_HIGHLIGHT: "bash:clear-highlight",
  GET_CONTENT: "bash:get-content",
  EXECUTE_ACTIONS: "bash:execute-actions",
  PLAN_STEP: "bash:plan-step",
  MATCH_OPTION: "bash:match-option",
  FILL_LEFTOVER_COMBOS: "bash:fill-leftover-combos",
  START_PIPELINE: "bash:start-pipeline",
  PIPELINE_PROGRESS: "bash:pipeline-progress",
  SOCKET_STATUS: "bash:socket-status",
  OPERATOR_NOTICE: "bash:operator-notice",
  AUTH_STATUS: "bash:auth-status",
  AUTH_SIGNIN: "bash:auth-signin",
  AUTH_SIGNOUT: "bash:auth-signout",
  LIST_WORKER_JOBS: "bash:list-worker-jobs",
  OPEN_WORKER_JOB: "bash:open-worker-job",
  MARK_JOB_APPLIED: "bash:mark-job-applied",
  GET_TAB_JOB: "bash:get-tab-job",
  REMEMBER_CUSTOM_TAB: "bash:remember-custom-tab",
  FORGET_CUSTOM_TAB: "bash:forget-custom-tab",
  FOCUS_CUSTOM_TAB: "bash:focus-custom-tab",
  START_CUSTOM_GENERATE: "bash:start-custom-generate",
  START_CUSTOM_RECOMMEND: "bash:start-custom-recommend",
  START_JOB_GENERATE: "bash:start-job-generate",
  START_JOB_RECOMMEND: "bash:start-job-recommend",
  SELECTION_QA: "bash:selection-qa",
} as const;

export type BashNoticeKind = "error" | "success" | "info";

export type BashNoticePayload = {
  kind: BashNoticeKind;
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
  usage?: import("@bash/shared/ai-usage").AiUsageSummary;
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
