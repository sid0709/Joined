import { useEffect, useMemo, useState } from "react";
import {
  IDLE_PIPELINE_PROGRESS,
  mergePipelineProgress,
  type PipelineProgress,
} from "@acorn/shared/pipeline-types";
import {
  listTabJobs,
  TAB_JOBS_STORAGE_KEY,
  type JobAttachment,
  type TabJobMap,
} from "../tab-job-session";
import {
  listCustomTabs,
  TAB_CUSTOM_STORAGE_KEY,
  type CustomTabMap,
  type AcornCustomTabBinding,
} from "../tab-custom-session";
import {
  JOB_GENERATE_STORAGE_KEY,
  listJobGenerates,
  type JobGenerateMap,
} from "../tab-job-generate-session";
import {
  listTabPipelines,
  TAB_PIPELINES_STORAGE_KEY,
  type TabPipelineMap,
} from "../tab-pipeline-session";
import { MSG } from "../types";

export function useTabSession(activeTabId: number | null) {
  const [tabJobs, setTabJobs] = useState<TabJobMap>({});
  const [customTabs, setCustomTabs] = useState<CustomTabMap>({});
  const [jobGenerates, setJobGenerates] = useState<JobGenerateMap>({});
  const [pipelines, setPipelines] = useState<TabPipelineMap>({});

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [jobs, custom, generates, progress] = await Promise.all([
        listTabJobs(),
        listCustomTabs(),
        listJobGenerates(),
        listTabPipelines(),
      ]);
      if (!alive) return;
      setTabJobs(jobs);
      setCustomTabs(custom);
      setJobGenerates(generates);
      setPipelines(progress);
    })();

    const onChanged: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
      area,
    ) => {
      if (area !== "session") return;
      if (changes[TAB_JOBS_STORAGE_KEY]) {
        const next = changes[TAB_JOBS_STORAGE_KEY].newValue;
        setTabJobs(next && typeof next === "object" ? (next as TabJobMap) : {});
      }
      if (changes[TAB_CUSTOM_STORAGE_KEY]) {
        const next = changes[TAB_CUSTOM_STORAGE_KEY].newValue;
        setCustomTabs(next && typeof next === "object" ? (next as CustomTabMap) : {});
      }
      if (changes[JOB_GENERATE_STORAGE_KEY]) {
        const next = changes[JOB_GENERATE_STORAGE_KEY].newValue;
        setJobGenerates(next && typeof next === "object" ? (next as JobGenerateMap) : {});
      }
      if (changes[TAB_PIPELINES_STORAGE_KEY]) {
        const next = changes[TAB_PIPELINES_STORAGE_KEY].newValue;
        setPipelines(next && typeof next === "object" ? (next as TabPipelineMap) : {});
      }
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => {
      alive = false;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  useEffect(() => {
    const onMessage = (message: { type?: string; tabId?: number; progress?: PipelineProgress }) => {
      if (message.type !== MSG.PIPELINE_PROGRESS || !message.progress) return;
      if (typeof message.tabId !== "number") return;
      const tabId = message.tabId;
      const next = message.progress;
      setPipelines((prev) => {
        const key = String(tabId);
        return {
          ...prev,
          [key]: mergePipelineProgress(prev[key] ?? IDLE_PIPELINE_PROGRESS, next),
        };
      });
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, []);

  const tabKey = activeTabId != null ? String(activeTabId) : null;
  const tabJob = tabKey ? (tabJobs[tabKey] ?? null) : null;
  const customTab: AcornCustomTabBinding | null = tabKey ? (customTabs[tabKey] ?? null) : null;
  const progress = tabKey ? (pipelines[tabKey] ?? IDLE_PIPELINE_PROGRESS) : IDLE_PIPELINE_PROGRESS;

  const attachments = useMemo(() => {
    const next: Record<string, JobAttachment> = {};
    for (const [id, job] of Object.entries(tabJobs)) {
      const tabId = Number(id);
      if (!Number.isFinite(tabId)) continue;
      next[job.jobId] = { tabId, active: tabId === activeTabId };
    }
    return next;
  }, [tabJobs, activeTabId]);

  const customList = useMemo(() => {
    return Object.values(customTabs).sort((a, b) => (a.rememberedAt < b.rememberedAt ? 1 : -1));
  }, [customTabs]);

  return {
    tabJobs,
    tabJob,
    customTab,
    customList,
    jobGenerates,
    pipelines,
    progress,
    attachments,
    setPipelines,
  };
}
