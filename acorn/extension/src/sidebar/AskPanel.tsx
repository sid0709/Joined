import { QaPanel } from "./QaPanel";
import type { AcornMainTab } from "./SidebarNav";
import type { TabSession } from "./sidebar-panel-types";

interface Props {
  mainTab: AcornMainTab;
  fillBusy: boolean;
  setQaStatus: (status: { busy: boolean; error: boolean }) => void;
  tabJob: TabSession["tabJob"];
}

/** The Ask tab: Q&A about the job on this tab. */
export function AskPanel({ mainTab, fillBusy, setQaStatus, tabJob }: Props) {
  return (
    <section
      id="acorn-panel-qa"
      className="acorn-panel acorn-panel-ask"
      aria-label="Ask"
      hidden={mainTab !== "qa"}
    >
      <QaPanel
        signedIn
        disabled={fillBusy}
        onStatus={setQaStatus}
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
    </section>
  );
}
