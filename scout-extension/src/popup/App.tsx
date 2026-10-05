import "@joined/design-system/styles/joined.css";
import { Button, Spinner } from "@joined/design-system";

import { getSignInUrl } from "../api";
import {
  SIGN_IN_TAB_WATCH_INTERVAL_MS,
  SIGN_IN_TAB_WATCH_TIMEOUT_MS,
  applySignInTabClose,
  scheduleAuthRefresh,
} from "../auth/signInTab";
import { isJobQueued } from "../drafts";
import { useAuth } from "../hooks/useAuth";
import { useDetectedJob } from "../hooks/useDetectedJob";
import { useDrafts } from "../hooks/useDrafts";
import { DetectedJobPanel } from "./DetectedJobPanel";
import { DraftQueuePanel } from "./DraftQueuePanel";

function App() {
  const { authState, checkAuth, setSignInTabId } = useAuth();
  const detectedJob = useDetectedJob();
  const { drafts, saveCapturedJob, updateDraft, deleteDraft, submitDraft, submitAll } = useDrafts();
  const signedIn = authState.status === "signed-in";
  const alreadyQueued = detectedJob.status === "found" && isJobQueued(drafts, detectedJob.job);

  const handleSignIn = () => {
    const signInUrl = getSignInUrl();
    const newTab = window.open(signInUrl, "_blank");

    if (newTab) {
      chrome.tabs.query({ url: signInUrl }, (tabs) => {
        if (tabs.length > 0 && tabs[0].id) {
          setSignInTabId(tabs[0].id);
        }
      });

      const checkInterval = setInterval(() => {
        if (newTab.closed) {
          clearInterval(checkInterval);
          const decision = applySignInTabClose(null);
          if (decision.refresh) {
            scheduleAuthRefresh(checkAuth);
          }
          setSignInTabId(decision.nextTabId);
        }
      }, SIGN_IN_TAB_WATCH_INTERVAL_MS);

      setTimeout(() => {
        clearInterval(checkInterval);
      }, SIGN_IN_TAB_WATCH_TIMEOUT_MS);
    }
  };

  return (
    <div
      style={{
        padding: "var(--spacing-4)",
        minWidth: "300px",
        minHeight: "200px",
      }}
    >
      <h1
        style={{
          fontSize: "var(--font-size-xl)",
          fontWeight: 600,
          marginBottom: "var(--spacing-4)",
        }}
      >
        Scout
      </h1>

      {authState.status === "loading" && (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-2)" }}>
          <Spinner size="sm" />
          <span>Checking sign-in status...</span>
        </div>
      )}

      {authState.status === "signed-out" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-3)" }}>
          <p style={{ color: "var(--color-text-secondary)" }}>
            Sign in to Scout to submit drafts. You can still save jobs on this device while signed
            out.
          </p>
          <Button onClick={handleSignIn} variant="primary" label="Sign In to Scout" />
        </div>
      )}

      {authState.status === "signed-in" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-3)" }}>
          <div>
            <div style={{ fontWeight: 600 }}>{authState.profile.name}</div>
            <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)" }}>
              {authState.profile.email}
            </div>
          </div>
          <div
            style={{
              padding: "var(--spacing-3)",
              backgroundColor: "var(--color-background-secondary)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)" }}>
              Level: <strong>{authState.profile.level}</strong>
            </div>
          </div>
        </div>
      )}

      {authState.status === "error" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-3)" }}>
          <div
            style={{
              padding: "var(--spacing-3)",
              backgroundColor: "var(--color-background-error)",
              borderRadius: "var(--radius-md)",
              color: "var(--color-text-error)",
            }}
          >
            Error: {authState.error}
          </div>
          <Button onClick={() => checkAuth()} variant="secondary" label="Try Again" />
        </div>
      )}

      <div style={{ marginTop: "var(--spacing-4)" }}>
        <DetectedJobPanel
          state={detectedJob}
          alreadyQueued={alreadyQueued}
          onSaveToDrafts={(job) => {
            void saveCapturedJob(job);
          }}
        />
      </div>

      <div style={{ marginTop: "var(--spacing-4)" }}>
        <DraftQueuePanel
          drafts={drafts}
          signedIn={signedIn}
          onEdit={(id, fields) => {
            void updateDraft(id, fields);
          }}
          onDelete={(id) => {
            void deleteDraft(id);
          }}
          onSubmit={(id) => {
            void submitDraft(id);
          }}
          onSubmitAll={() => {
            void submitAll();
          }}
        />
      </div>
    </div>
  );
}

export default App;
