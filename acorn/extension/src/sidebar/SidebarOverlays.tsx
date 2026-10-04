import { FaceGuidePanel } from "./FaceGuidePanel";
import { InspectPanel } from "./InspectPanel";
import { ResumePreviewPanel } from "./ResumePreviewPanel";
import { SettingsDrawer } from "./SettingsDrawer";
import type {
  BusyCounts,
  JdPreview,
  PlanInspect,
  ResumePreview,
  SidebarAuth,
  TabUiState,
} from "./sidebar-panel-types";

interface Props {
  activeTabId: number | null;
  preview: ResumePreview["preview"];
  setPreview: ResumePreview["setPreview"];
  jdPreview: JdPreview | null;
  setJdPreview: (preview: JdPreview | null) => void;
  ui: TabUiState["ui"];
  patchTabUi: TabUiState["patchTabUi"];
  inspectView: PlanInspect["inspectView"];
  inspectWindow: PlanInspect["inspectWindow"];
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
  busyCounts: BusyCounts;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  connected: boolean;
  session: SidebarAuth["session"];
  apiUrl: SidebarAuth["apiUrl"];
  setApiUrl: SidebarAuth["setApiUrl"];
}

/** Drawers and panels over the sidebar: résumé and JD previews, inspect, the Face guide, and settings. */
export function SidebarOverlays({
  activeTabId,
  preview,
  setPreview,
  jdPreview,
  setJdPreview,
  ui,
  patchTabUi,
  inspectView,
  inspectWindow,
  helpOpen,
  setHelpOpen,
  busyCounts,
  settingsOpen,
  setSettingsOpen,
  connected,
  session,
  apiUrl,
  setApiUrl,
}: Props) {
  return (
    <>
      {preview ? (
        <ResumePreviewPanel
          title={preview.title}
          sourceKey={preview.sourceKey}
          loadHtml={preview.loadHtml}
          downloadFile={preview.downloadFile}
          onClose={() => setPreview(null)}
        />
      ) : null}

      {jdPreview ? (
        <InspectPanel
          title={`Job description · ${jdPreview.title}`}
          lines={jdPreview.text.split("\n")}
          hasMore={false}
          onLoadMore={() => undefined}
          onCopy={() => navigator.clipboard.writeText(jdPreview.text)}
          onClose={() => setJdPreview(null)}
        />
      ) : null}

      {ui.inspect && inspectView ? (
        <InspectPanel
          title={ui.inspect.title}
          lines={inspectView.lines}
          hasMore={inspectView.hasMore}
          onLoadMore={inspectWindow.loadMore}
          onCopy={inspectView.copy}
          onClose={() => {
            if (activeTabId != null) patchTabUi(activeTabId, { inspect: null });
          }}
        />
      ) : null}

      {/* Mounted only while open: the guide runs a live Acorn Face per mood. */}
      {helpOpen ? (
        <FaceGuidePanel
          isOpen
          onOpenChange={setHelpOpen}
          thinking={busyCounts.thinking}
          working={busyCounts.working}
        />
      ) : null}
      {settingsOpen ? (
        <SettingsDrawer
          isOpen
          onOpenChange={setSettingsOpen}
          connected={connected}
          signedIn={Boolean(session)}
          apiUrl={apiUrl}
          onApiUrlChange={setApiUrl}
        />
      ) : null}
    </>
  );
}
