import type { PipelineProgress } from "@acorn/shared/pipeline-types";
import { DEFAULT_ATHENS_API_URL, setAthensApiUrl } from "../auth/acorn-auth";

type ConnectionFooterProps = {
  phase: PipelineProgress["phase"];
  connected: boolean;
  signedIn: boolean;
  status: string;
  apiUrl: string;
  onApiUrlChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
};

/** Footer strip: connection dot and status; expands to the API URL and socket state. */
export function ConnectionFooter({
  phase,
  connected,
  signedIn,
  status,
  apiUrl,
  onApiUrlChange,
  onOpenChange,
}: ConnectionFooterProps) {
  return (
    <footer className={`status-bar phase-${phase}`}>
      <details
        className="acorn-connection-footer"
        onToggle={(event) => onOpenChange((event.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="acorn-connection-summary">
          <span className={`acorn-settings-dot ${connected ? "on" : "off"}`} aria-hidden="true" />
          <span className="acorn-connection-title">Connection</span>
          <span className="acorn-connection-state">{status}</span>
        </summary>
        <div className="acorn-connection-body">
          <label className="field">
            <span>Acorn API URL</span>
            <input
              value={apiUrl}
              onChange={(e) => {
                const value = e.target.value;
                onApiUrlChange(value);
                void setAthensApiUrl(value);
              }}
              placeholder={DEFAULT_ATHENS_API_URL}
            />
          </label>
          <div className={`conn-status ${connected ? "on" : "off"}`}>
            <span className="dot" />
            {connected ? "Socket connected" : signedIn ? "Socket offline" : "Sign in to connect"}
          </div>
        </div>
      </details>
    </footer>
  );
}
