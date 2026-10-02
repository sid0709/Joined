import type { CSSProperties } from "react";
import type { AcornFaceMode } from "@acorn/face";
import type { AcornStoredSession } from "../auth/acorn-auth";
import { ACORN_FACE_BADGE_PX, ACORN_FACE_BRAND_PX } from "../acorn-face/constants";
import { AcornFaceView } from "../acorn-face/AcornFaceView";
import type { countBusyWorkers } from "../acorn-face/director";
import { HelpIcon, SignOutIcon } from "./sidebar-icons";

type IdentityBarProps = {
  session: AcornStoredSession | null;
  companionMode: AcornFaceMode;
  workersMode: AcornFaceMode;
  busyCounts: ReturnType<typeof countBusyWorkers>;
  busyTotal: number;
  helpOpen: boolean;
  signOutDisabled: boolean;
  onToggleHelp: () => void;
  onSignOut: () => void;
};

/** Top row: Acorn Face, product name, and (signed in) name, worker chip, Help, Sign out. */
export function IdentityBar({
  session,
  companionMode,
  workersMode,
  busyCounts,
  busyTotal,
  helpOpen,
  signOutDisabled,
  onToggleHelp,
  onSignOut,
}: IdentityBarProps) {
  return (
    <section
      className="welcome"
      style={{ "--acorn-face-brand-px": `${ACORN_FACE_BRAND_PX}px` } as CSSProperties}
    >
      <div className="brand-bar">
        <AcornFaceView
          className="brand-logo"
          mode={companionMode}
          size={ACORN_FACE_BRAND_PX}
          live
          label="Acorn"
        />
        <h2>Acorn</h2>
        {session ? (
          <>
            <p className="brand-user">{session.displayName}</p>
            <div className="brand-actions">
              <div
                className={`brand-workers${busyTotal > 0 ? " is-busy" : ""}`}
                role="status"
                aria-live="polite"
                title={
                  busyTotal > 0
                    ? `${busyTotal} working · ${busyCounts.thinking} thinking, ${busyCounts.working} filling`
                    : "No workers in flight"
                }
                aria-label={`${busyTotal} working`}
              >
                <AcornFaceView
                  className="brand-workers-face"
                  mode={workersMode}
                  size={ACORN_FACE_BADGE_PX}
                  live={busyTotal > 0}
                  label="Workers"
                />
                <span className="brand-workers-count">{busyTotal}</span>
              </div>
              <button
                type="button"
                className={`brand-icon-btn${helpOpen ? " is-open" : ""}`}
                onClick={onToggleHelp}
                title={helpOpen ? "Close Acorn Face guide" : "Acorn Face guide"}
                aria-label={helpOpen ? "Close Acorn Face guide" : "Acorn Face guide"}
                aria-pressed={helpOpen}
              >
                <HelpIcon />
              </button>
              <button
                type="button"
                className="brand-icon-btn"
                onClick={onSignOut}
                disabled={signOutDisabled}
                title="Sign out"
                aria-label="Sign out"
              >
                <SignOutIcon />
              </button>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
