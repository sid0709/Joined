import type { ComponentProps } from "react";
import { Button, Text } from "@joined/design-system";
import { QaPanel } from "./QaPanel";
import { SidebarMainTabs, type AcornMainTab } from "./SidebarMainTabs";
import type { useTabSession } from "./use-tab-session";

type TabSession = ReturnType<typeof useTabSession>;

type SidebarToolsProps = {
  signedIn: boolean;
  mainTab: AcornMainTab;
  onTabChange: (next: AcornMainTab) => void;
  tabJob: TabSession["tabJob"];
  customTab: TabSession["customTab"];
  activeTabId: number | null;
  fillBusy: boolean;
  tabWorkBusy: boolean;
  onQaStatus: ComponentProps<typeof QaPanel>["onStatus"];
  onRemember: () => void;
};

/** Fill / Q&A / Custom tabs, the Q&A panel, and Custom's Remember tab button. */
export function SidebarTools({
  signedIn,
  mainTab,
  onTabChange,
  tabJob,
  customTab,
  activeTabId,
  fillBusy,
  tabWorkBusy,
  onQaStatus,
  onRemember,
}: SidebarToolsProps) {
  return (
    <section className="tools">
      {signedIn ? (
        <SidebarMainTabs value={mainTab} onChange={onTabChange} />
      ) : (
        <Text as="h3" weight="semibold">
          Fill
        </Text>
      )}
      {signedIn ? (
        <div
          id="acorn-panel-qa"
          className="sidebar-tab-panel"
          role="tabpanel"
          aria-labelledby="acorn-tab-qa"
          hidden={mainTab !== "qa"}
        >
          <QaPanel
            signedIn
            showHeading={false}
            disabled={fillBusy}
            onStatus={onQaStatus}
            page={
              tabJob
                ? {
                    job: {
                      id: tabJob.jobId,
                      title: tabJob.title,
                      company: tabJob.company,
                    },
                  }
                : null
            }
          />
        </div>
      ) : null}

      {signedIn ? (
        <div
          id="acorn-panel-custom"
          className="sidebar-tab-panel"
          role="tabpanel"
          aria-labelledby="acorn-tab-custom"
          hidden={mainTab !== "custom"}
        >
          <Button
            variant="secondary"
            label={customTab ? "Tab remembered" : "Remember tab"}
            width="100%"
            isDisabled={!signedIn || activeTabId == null || Boolean(customTab) || tabWorkBusy}
            onClick={onRemember}
          />
        </div>
      ) : null}
    </section>
  );
}
