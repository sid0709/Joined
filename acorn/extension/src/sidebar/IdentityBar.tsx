import type { CSSProperties } from "react";
import type { AcornFaceMode } from "@acorn/face";
import { Badge, Glyph, HStack, IconButton, Text } from "@joined/design-system";
import type { AcornStoredSession } from "../auth/acorn-auth";
import { ACORN_FACE_BADGE_PX, ACORN_FACE_BRAND_PX } from "../acorn-face/constants";
import { AcornFaceView } from "../acorn-face/AcornFaceView";
import type { countBusyWorkers } from "../acorn-face/director";

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
    <HStack
      as="section"
      className="welcome"
      gap={2}
      align="center"
      style={{ "--acorn-face-brand-px": `${ACORN_FACE_BRAND_PX}px` } as CSSProperties}
    >
      <AcornFaceView
        className="brand-logo"
        mode={companionMode}
        size={ACORN_FACE_BRAND_PX}
        live
        label="Acorn"
      />
      <Text as="h2" type="large" weight="semibold">
        Acorn
      </Text>
      {session ? (
        <>
          <Text className="brand-user" type="supporting" maxLines={1}>
            {session.displayName}
          </Text>
          <HStack gap={1} align="center">
            <span
              role="status"
              aria-live="polite"
              aria-label={`${busyTotal} working`}
              title={
                busyTotal > 0
                  ? `${busyTotal} working · ${busyCounts.thinking} thinking, ${busyCounts.working} filling`
                  : "No workers in flight"
              }
            >
              <Badge
                variant={busyTotal > 0 ? "info" : "neutral"}
                icon={
                  <AcornFaceView
                    mode={workersMode}
                    size={ACORN_FACE_BADGE_PX}
                    live={busyTotal > 0}
                    label="Workers"
                  />
                }
                label={busyTotal}
              />
            </span>
            <IconButton
              variant={helpOpen ? "secondary" : "ghost"}
              size="sm"
              icon={<Glyph name="info" />}
              label={helpOpen ? "Close Acorn Face guide" : "Acorn Face guide"}
              tooltip={helpOpen ? "Close Acorn Face guide" : "Acorn Face guide"}
              aria-pressed={helpOpen}
              onClick={onToggleHelp}
            />
            <IconButton
              variant="ghost"
              size="sm"
              icon={<Glyph name="signOut" />}
              label="Sign out"
              tooltip="Sign out"
              isDisabled={signOutDisabled}
              onClick={onSignOut}
            />
          </HStack>
        </>
      ) : null}
    </HStack>
  );
}
