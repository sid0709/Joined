import type { AcornFaceMode } from "@acorn/face";
import type { PipelinePhase, PipelineProgress } from "@acorn/shared/pipeline-types";
import { EXTRACT_LABEL, LOAD_JD_LABEL } from "../pipeline/custom-generate-progress";
import type { CustomGenerateStatus } from "../tab-custom-session";

export type RowFaceInput = {
  fillPhase?: PipelinePhase | null;
  resumeSkipped?: boolean;
  generateStatus?: CustomGenerateStatus | null;
  generateLabel?: string | null;
  hasResume?: boolean;
  blocked?: boolean;
  recommendWarning?: boolean;
  selected?: boolean;
  opening?: boolean;
  marking?: boolean;
  downloading?: boolean;
};

export type TabFaceInput = {
  signedIn: boolean;
  fillPhase?: PipelinePhase | null;
  resumeSkipped?: boolean;
  generateStatus?: CustomGenerateStatus | null;
  generateLabel?: string | null;
  hasResume?: boolean;
  hidden?: boolean;
};

export type CompanionFaceInput = {
  signedIn: boolean;
  authBusy: boolean;
  nameFocused: boolean;
  connected: boolean;
  anyTabWorking: boolean;
  focused: TabFaceInput;
  qaBusy: boolean;
  qaError: boolean;
  inspectOpen: boolean;
  connectionOpen: boolean;
  jobsLoading: boolean;
  jobsEmpty: boolean;
  jobsError: boolean;
  customEmpty: boolean;
  opening: boolean;
  marking: boolean;
  afk: boolean;
  emptyIdle: boolean;
};

function generatingThink(status?: CustomGenerateStatus | null, label?: string | null): boolean {
  if (status === "queued") return true;
  return status === "running" && (label === EXTRACT_LABEL || label === LOAD_JD_LABEL || !label);
}

function generatingWork(status?: CustomGenerateStatus | null, label?: string | null): boolean {
  return status === "running" && !generatingThink(status, label);
}

export function holdFromFill(
  phase?: PipelinePhase | null,
  resumeSkipped = false,
): AcornFaceMode | null {
  if (phase === "analyzing") return "thinking";
  if (phase === "fetching" || phase === "running") return "working";
  if (phase === "error") return "sad";
  if (phase === "done" && resumeSkipped) return "sad";
  return null;
}

export function holdFromGenerate(
  status?: CustomGenerateStatus | null,
  label?: string | null,
  hasResume = false,
): AcornFaceMode | null {
  if (generatingThink(status, label)) return "thinking";
  if (generatingWork(status, label)) return "working";
  if (status === "failed") return "sad";
  if (!hasResume && (status === "idle" || status === "completed" || status == null)) {
    return null;
  }
  return null;
}

/** Hold pose for one job / remembered tab. One-shots are applied by playback. */
export function resolveRowHold(input: RowFaceInput): AcornFaceMode {
  if (input.marking) return "smile";
  if (input.opening || input.downloading) return "working";
  const fill = holdFromFill(input.fillPhase, input.resumeSkipped);
  if (fill === "working" || fill === "thinking" || fill === "sad") return fill;
  const gen = holdFromGenerate(input.generateStatus, input.generateLabel, input.hasResume);
  if (gen) return gen;
  if (input.blocked) return "help";
  if (input.recommendWarning && input.selected) return "help";
  if (input.hasResume === false && input.generateStatus != null) return "sad";
  return "waiting";
}

export type BusyWorkerCounts = {
  thinking: number;
  working: number;
};

/** Unique tabs currently thinking or working (fill + Custom). */
export function countBusyWorkers(
  pipelines: Record<string, PipelineProgress>,
  customTabs: Array<{
    tabId: number;
    generateStatus: CustomGenerateStatus;
    generateProgress?: { label?: string } | null;
    generationId?: string | null;
    recommendedResumeId?: string | null;
  }>,
  jobGenerates: Array<{
    jobId: string;
    tabId?: number | null;
    generateStatus: CustomGenerateStatus;
    generateProgress?: { label?: string } | null;
  }> = [],
): BusyWorkerCounts {
  const modes = new Map<string, AcornFaceMode>();
  for (const [tabId, progress] of Object.entries(pipelines)) {
    const mode = holdFromFill(progress.phase, progress.resumeUpload?.status === "skipped");
    if (mode === "thinking" || mode === "working") modes.set(tabId, mode);
  }
  for (const tab of customTabs) {
    const key = String(tab.tabId);
    if (modes.has(key)) continue;
    const mode = holdFromGenerate(
      tab.generateStatus,
      tab.generateProgress?.label,
      Boolean(tab.generationId || tab.recommendedResumeId),
    );
    if (mode === "thinking" || mode === "working") modes.set(key, mode);
  }
  for (const row of jobGenerates) {
    const key = row.tabId != null ? String(row.tabId) : `job:${row.jobId}`;
    if (modes.has(key)) continue;
    const mode = holdFromGenerate(row.generateStatus, row.generateProgress?.label, false);
    if (mode === "thinking" || mode === "working") modes.set(key, mode);
  }
  let thinking = 0;
  let working = 0;
  for (const mode of modes.values()) {
    if (mode === "thinking") thinking += 1;
    else working += 1;
  }
  return { thinking, working };
}

/** Hold pose for the focused tab. */
export function resolveTabHold(input: TabFaceInput): AcornFaceMode {
  if (!input.signedIn) return "sleeping";
  const fill = holdFromFill(input.fillPhase, input.resumeSkipped);
  if (fill === "working" || fill === "thinking" || fill === "sad") return fill;
  const gen = holdFromGenerate(input.generateStatus, input.generateLabel, input.hasResume);
  if (gen) return gen;
  if (input.hidden) return "sleeping";
  return "waiting";
}

/** Companion hold. One-shots (smile/wink/notice) overlay in playback. */
export function resolveCompanionHold(input: CompanionFaceInput): AcornFaceMode {
  const focused = resolveTabHold(input.focused);
  if (focused === "working" || focused === "thinking" || focused === "sad") return focused;
  if (input.qaBusy) return "thinking";
  if (input.qaError) return "sad";
  if (input.opening || input.marking || input.authBusy) return "working";
  if (input.jobsLoading || input.inspectOpen || input.connectionOpen) return "thinking";
  if (input.anyTabWorking) return "working";
  if (input.signedIn && !input.connected) return "sad";
  if (input.jobsError) return "sad";
  if (input.jobsEmpty) return input.emptyIdle ? "sleeping" : "sad";
  if (input.customEmpty) return "thinking";
  if (!input.signedIn) {
    if (input.authBusy) return "working";
    return input.nameFocused ? "waiting" : "sleeping";
  }
  if (input.afk) return "sleeping";
  if (focused === "sleeping") return "waiting";
  return focused;
}

export function tabInputFromProgress(
  signedIn: boolean,
  progress: PipelineProgress | null | undefined,
  generate?: {
    status?: CustomGenerateStatus | null;
    label?: string | null;
    hasResume?: boolean;
  },
  hidden = false,
): TabFaceInput {
  return {
    signedIn,
    fillPhase: progress?.phase ?? "idle",
    resumeSkipped: progress?.resumeUpload?.status === "skipped",
    generateStatus: generate?.status ?? null,
    generateLabel: generate?.label ?? null,
    hasResume: Boolean(generate?.hasResume),
    hidden,
  };
}

export function isLiveRowMode(mode: AcornFaceMode, selected: boolean): boolean {
  if (selected) return true;
  return mode !== "waiting";
}

export function mergeFaceShot(hold: AcornFaceMode, shot: AcornFaceMode | null): AcornFaceMode {
  if (!shot) return hold;
  if (hold === "working" || hold === "thinking" || hold === "sad") return hold;
  return shot;
}
