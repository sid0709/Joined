import type { Socket } from "socket.io-client";
import {
  runActionPlan as runSharedActionPlan,
  type OrchestratorHooks,
  type RunPlanOptions as SharedRunPlanOptions,
} from "@acorn/shared/plan-runner/orchestrator";
import type {
  ActionPlan,
  PlanStepPayload,
  PlanStepResult,
  RuntimeAttachedFile,
  RunReport,
} from "./types";

export type { OrchestratorHooks };

export interface RunPlanOptions {
  plan: ActionPlan;
  socket: Socket;
  tabId: number;
  url: string;
  extensionId?: string;
  frameId?: number | null;
  runtimeFile: RuntimeAttachedFile | null;
  recommendedResume?: RuntimeAttachedFile | null;
  customResume?: RuntimeAttachedFile | null;
  resumeFileKind?: "library" | "custom";
  hooks: OrchestratorHooks;
}

function emitPlanStep(
  socket: Socket,
  args: {
    tabId: number;
    url: string;
    extensionId?: string;
    frameId?: number | null;
    step: PlanStepPayload;
  },
): Promise<PlanStepResult> {
  return new Promise((resolve, reject) => {
    socket.timeout(45000).emit(
      "dom:plan-step",
      {
        tabId: args.tabId,
        url: args.url,
        extensionId: args.extensionId,
        frameId: args.frameId ?? undefined,
        step: args.step,
      },
      (err: Error | null, res: PlanStepResult) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(res ?? { ok: false, error: "No response from extension" });
      },
    );
  });
}

export async function runActionPlan(options: RunPlanOptions): Promise<RunReport> {
  const {
    plan,
    socket,
    tabId,
    url,
    extensionId,
    frameId,
    runtimeFile,
    recommendedResume,
    customResume,
    resumeFileKind,
    hooks,
  } = options;

  const sharedOptions: SharedRunPlanOptions = {
    plan,
    runtimeFile,
    recommendedResume: recommendedResume ?? null,
    customResume: customResume ?? null,
    resumeFileKind,
    hooks,
    executeStep: (step) => emitPlanStep(socket, { tabId, url, extensionId, frameId, step }),
  };

  return runSharedActionPlan(sharedOptions);
}
