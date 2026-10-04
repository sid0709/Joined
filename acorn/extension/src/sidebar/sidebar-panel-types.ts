import type { countBusyWorkers } from "../acorn-face/director";
import type { usePlanInspect } from "./use-plan-inspect";
import type { useResumePreview } from "./use-resume-preview";
import type { useSidebarAuth } from "./use-sidebar-auth";
import type { useTabSession } from "./use-tab-session";
import type { useTabUi } from "./use-tab-ui";
import type { useTabWork } from "./use-tab-work";
import type { useWorkerJobs } from "./use-worker-jobs";

/** What the sidebar hooks return, so panels take exactly the values SidebarApp holds. */
export type TabSession = ReturnType<typeof useTabSession>;
export type WorkerJobs = ReturnType<typeof useWorkerJobs>;
export type TabWork = ReturnType<typeof useTabWork>;
export type ResumePreview = ReturnType<typeof useResumePreview>;
export type PlanInspect = ReturnType<typeof usePlanInspect>;
export type TabUiState = ReturnType<typeof useTabUi>;
export type SidebarAuth = ReturnType<typeof useSidebarAuth>;
export type BusyCounts = ReturnType<typeof countBusyWorkers>;

/** A job description shown in the inspect drawer. */
export type JdPreview = { title: string; text: string };
