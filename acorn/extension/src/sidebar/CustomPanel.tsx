import type { ReactNode } from "react";
import { CustomTabList } from "./CustomTabList";
import type { AcornMainTab } from "./SidebarNav";
import type { JdPreview, ResumePreview, TabSession, TabWork } from "./sidebar-panel-types";

interface Props {
  mainTab: AcornMainTab;
  nowCard: ReactNode;
  customList: TabSession["customList"];
  pipelines: TabSession["pipelines"];
  activeTabId: number | null;
  focusCustomTab: TabWork["focusCustomTab"];
  forgetCustomTab: TabWork["forgetCustomTab"];
  startCustomWork: TabWork["startCustomWork"];
  openCustomResumePreview: ResumePreview["openCustomResumePreview"];
  setJdPreview: (preview: JdPreview | null) => void;
}

/** The Tabs tab: the Now card and the remembered Custom tabs. */
export function CustomPanel({
  mainTab,
  nowCard,
  customList,
  pipelines,
  activeTabId,
  focusCustomTab,
  forgetCustomTab,
  startCustomWork,
  openCustomResumePreview,
  setJdPreview,
}: Props) {
  return (
    <section
      id="acorn-panel-custom"
      className="acorn-panel"
      aria-label="Tabs"
      hidden={mainTab !== "custom"}
    >
      {nowCard}
      <CustomTabList
        tabs={customList}
        pipelines={pipelines}
        activeTabId={activeTabId}
        listActive={mainTab === "custom"}
        onFocus={(tabId) => void focusCustomTab(tabId)}
        onForget={(tabId) => void forgetCustomTab(tabId)}
        onPreview={openCustomResumePreview}
        onContinueGenerate={(tab) =>
          void startCustomWork(tab.workKind === "recommend" ? "recommend" : "generate", {
            continue: true,
            tab,
          })
        }
        onRestartGenerate={(tab) =>
          void startCustomWork(tab.workKind === "recommend" ? "recommend" : "generate", {
            continue: false,
            tab,
          })
        }
        onViewJd={(tab, jd) => setJdPreview({ title: tab.title || "Untitled", text: jd })}
      />
    </section>
  );
}
