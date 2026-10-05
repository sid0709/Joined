import { useLayoutEffect, useRef, useState } from "react";
import { Badge, EmptyState, HStack, Text, VStack } from "sid-ui";
import { canContinueGenerate } from "@acorn/shared/generate-checkpoint";
import { isFillPhaseBusy, type PipelineProgress } from "@acorn/shared/pipeline-types";
import { FACE_WINK_MS } from "../acorn-face/constants";
import { resolveRowHold } from "../acorn-face/director";
import { flashAcornFace } from "../acorn-face/face-flash";
import { useCompletionSmile } from "../acorn-face/use-completion-smile";
import { fetchCustomResume } from "../pipeline/api/custom-files";
import { fetchCustomLibraryResume } from "../pipeline/api/custom-library";
import { customUiProgress } from "../pipeline/custom-generate-progress";
import { customRecommendProgress } from "../pipeline/custom-recommend-progress";
import { customTabHasResume, type AcornCustomTabBinding } from "../tab-custom-session";
import type { TabPipelineMap } from "../tab-pipeline-session";
import { customTabResumeLine, hostOf } from "./custom-tab-resume";
import { triggerResumeDownload } from "./download-resume";
import { runExtras } from "./run-extras";
import { pushAcornNotice } from "./acorn-notice";
import { SidebarListCard } from "./SidebarListCard";

type CustomTabListProps = {
  tabs: AcornCustomTabBinding[];
  pipelines: TabPipelineMap;
  activeTabId: number | null;
  listActive?: boolean;
  onFocus: (tabId: number) => void;
  onForget: (tabId: number) => void;
  onPreview: (tab: AcornCustomTabBinding) => void;
  onContinueGenerate?: (tab: AcornCustomTabBinding) => void;
  onRestartGenerate?: (tab: AcornCustomTabBinding) => void;
  onViewJd?: (tab: AcornCustomTabBinding, jd: string) => void;
};

export function CustomTabList({
  tabs,
  pipelines,
  activeTabId,
  listActive = true,
  onFocus,
  onForget,
  onPreview,
  onContinueGenerate,
  onRestartGenerate,
  onViewJd,
}: CustomTabListProps) {
  const listRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (!listActive || activeTabId == null) return;
    const node = listRef.current?.querySelector(
      `[data-item-id="${CSS.escape(String(activeTabId))}"]`,
    );
    if (!(node instanceof HTMLElement)) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
  }, [listActive, activeTabId, tabs.length]);

  return (
    <VStack as="section" gap={3} className="worker-pool">
      <HStack gap={2} align="center">
        <Text as="h2" weight="semibold">
          Remembered tabs
        </Text>
        <Badge variant="neutral" label={tabs.length} />
      </HStack>
      {tabs.length === 0 ? (
        <EmptyState
          isCompact
          title="No remembered tabs"
          description="Remember the current tab to generate or recommend a résumé and Fill."
        />
      ) : (
        <VStack
          as="nav"
          ref={listRef}
          gap={2}
          className="worker-pool-list"
          aria-label="Remembered Custom tabs"
        >
          {tabs.map((tab) => (
            <CustomTabRow
              key={tab.tabId}
              tab={tab}
              progress={pipelines[String(tab.tabId)]}
              selected={tab.tabId === activeTabId}
              onFocus={() => onFocus(tab.tabId)}
              onForget={() => onForget(tab.tabId)}
              onPreview={() => onPreview(tab)}
              onContinueGenerate={onContinueGenerate}
              onRestartGenerate={onRestartGenerate}
              onViewJd={onViewJd}
            />
          ))}
        </VStack>
      )}
    </VStack>
  );
}

function CustomTabRow({
  tab,
  progress,
  selected,
  onFocus,
  onForget,
  onPreview,
  onContinueGenerate,
  onRestartGenerate,
  onViewJd,
}: {
  tab: AcornCustomTabBinding;
  progress?: PipelineProgress;
  selected: boolean;
  onFocus: () => void;
  onForget: () => void;
  onPreview: () => void;
  onContinueGenerate?: (tab: AcornCustomTabBinding) => void;
  onRestartGenerate?: (tab: AcornCustomTabBinding) => void;
  onViewJd?: (tab: AcornCustomTabBinding, jd: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [winkToken, setWinkToken] = useState(0);
  const filling = isFillPhaseBusy(progress?.phase ?? "idle");
  const generating = tab.generateStatus === "queued" || tab.generateStatus === "running";
  const { text: resumeText, ready, failed } = customTabResumeLine(tab, filling);
  const canContinue = canContinueGenerate(tab.generateStatus, tab.checkpoint);
  const jdText = tab.jobDescription || tab.checkpoint?.outputs.jobDescription;
  const canViewJd = Boolean(String(jdText || "").trim());
  const showBar = generating || canContinue;
  const host = hostOf(tab.url);
  const label = tab.title || "Untitled";
  const fileLocked = !ready || busy || generating;
  const recommending = tab.resumeMode === "recommend";

  const hold = resolveRowHold({
    fillPhase: progress?.phase ?? "idle",
    resumeSkipped: progress?.resumeUpload?.status === "skipped",
    generateStatus: tab.generateStatus,
    generateLabel: tab.generateProgress?.label ?? null,
    hasResume: customTabHasResume(tab),
    selected,
    downloading: busy,
  });
  const faceMode = useCompletionSmile({
    hold,
    fillPhase: progress?.phase ?? "idle",
    generateStatus: tab.generateStatus,
    winkToken,
  });

  const download = async () => {
    if (fileLocked) return;
    setBusy(true);
    try {
      const file = recommending
        ? await fetchCustomLibraryResume(String(tab.recommendedResumeId || ""))
        : await fetchCustomResume(String(tab.generationId || ""));
      if (!file?.base64 || !file.name) {
        pushAcornNotice({
          kind: "error",
          title: "Couldn’t download résumé",
          detail: recommending
            ? "Could not download the Library résumé"
            : "Could not download the stored editor résumé",
        });
        return;
      }
      triggerResumeDownload(file);
    } catch (err) {
      pushAcornNotice({
        kind: "error",
        title: "Couldn’t download résumé",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const emptyTitle = recommending ? "No resume assigned" : "Not generated...";

  return (
    <SidebarListCard
      itemId={String(tab.tabId)}
      selected={selected}
      attached
      faceMode={faceMode}
      logoUrl={tab.favIconUrl ?? undefined}
      logoFallback={label || host}
      title={label}
      subtitle={host}
      resumeText={resumeText}
      resumeReady={ready}
      resumeFailed={failed}
      open={{
        title: "Show this tab",
        label: `Show tab for ${label}`,
        current: selected,
        onClick: onFocus,
      }}
      download={{
        title: busy ? "Downloading…" : ready ? "Download résumé" : emptyTitle,
        label: busy
          ? "Downloading résumé"
          : ready
            ? `Download résumé for ${label}`
            : `No résumé yet for ${label}`,
        disabled: fileLocked,
        onClick: () => void download(),
      }}
      preview={{
        title: ready ? "Preview résumé" : emptyTitle,
        label: ready ? `Preview résumé for ${label}` : `No résumé yet for ${label}`,
        disabled: !ready || busy,
        onClick: () => {
          setWinkToken((n) => n + 1);
          flashAcornFace({ mode: "wink", ms: FACE_WINK_MS });
          onPreview();
        },
      }}
      check={{
        title: "Forget this tab",
        label: `Forget ${label}`,
        onClick: onForget,
      }}
      {...runExtras({
        progress:
          tab.generateProgress ??
          (recommending
            ? customRecommendProgress({
                status: tab.generateStatus,
                source: "custom",
              })
            : customUiProgress({
                status: tab.generateStatus,
                source: "custom",
                checkpoint: tab.checkpoint,
              })),
        showBar: showBar,
        canContinue: canContinue,
        canRestart: canContinue && Boolean(tab.checkpoint?.completedSteps.length),
        canViewJd: canViewJd,
        onContinue: () => onContinueGenerate?.(tab),
        onRestart: () => onRestartGenerate?.(tab),
        onViewJd: () => {
          if (jdText) onViewJd?.(tab, jdText);
        },
      })}
    />
  );
}
