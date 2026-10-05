import type { CSSProperties } from "react";
import type { AcornFaceMode } from "@acorn/face";
import { Avatar, AvatarStatusDot, Badge, Glyph, HStack, MoreMenu, Text, VStack } from "sid-ui";
import type { AcornStoredSession } from "../auth/acorn-auth";
import { ACORN_FACE_BADGE_PX, ACORN_FACE_BRAND_PX } from "../acorn-face/constants";
import { AcornFaceView } from "../acorn-face/AcornFaceView";
import type { countBusyWorkers } from "../acorn-face/director";

type SidebarHeaderProps = {
  session: AcornStoredSession;
  companionMode: AcornFaceMode;
  workersMode: AcornFaceMode;
  busyCounts: ReturnType<typeof countBusyWorkers>;
  busyTotal: number;
  connected: boolean;
  /** One line about the active Chrome tab: its job, its remembered title, or nothing yet. */
  context: string;
  signOutDisabled: boolean;
  onOpenGuide: () => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
};

/**
 * The live Acorn Face, what the active tab is, a worker chip while anything runs, and the
 * account menu. The avatar's dot is the socket connection.
 */
export function SidebarHeader({
  session,
  companionMode,
  workersMode,
  busyCounts,
  busyTotal,
  connected,
  context,
  signOutDisabled,
  onOpenGuide,
  onOpenSettings,
  onSignOut,
}: SidebarHeaderProps) {
  return (
    <HStack
      as="header"
      className="acorn-header"
      gap={3}
      align="center"
      style={{ "--acorn-face-brand-px": `${ACORN_FACE_BRAND_PX}px` } as CSSProperties}
    >
      <AcornFaceView
        className="acorn-header-face"
        mode={companionMode}
        size={ACORN_FACE_BRAND_PX}
        live
        label="Acorn"
      />
      <VStack gap={0} className="acorn-header-copy">
        <Text as="h1" type="large" weight="semibold">
          Acorn
        </Text>
        <Text type="supporting" maxLines={1} hasTruncateTooltip>
          {context}
        </Text>
      </VStack>
      {busyTotal > 0 ? (
        <span
          role="status"
          aria-live="polite"
          aria-label={`${busyTotal} working`}
          title={`${busyTotal} working · ${busyCounts.thinking} thinking, ${busyCounts.working} filling`}
        >
          <Badge
            variant="info"
            icon={
              <AcornFaceView mode={workersMode} size={ACORN_FACE_BADGE_PX} live label="Workers" />
            }
            label={busyTotal}
          />
        </span>
      ) : null}
      <MoreMenu
        label={`${session.displayName} · ${connected ? "connected" : "offline"}`}
        variant="ghost"
        alignment="end"
        icon={
          <Avatar
            name={session.displayName}
            size={32}
            status={
              <AvatarStatusDot
                variant={connected ? "success" : "neutral"}
                label={connected ? "Connected" : "Offline"}
              />
            }
          />
        }
        items={[
          {
            type: "section",
            title: session.displayName,
            items: [
              { label: "Acorn Face guide", icon: <Glyph name="info" />, onClick: onOpenGuide },
              { label: "Settings", icon: <Glyph name="settings" />, onClick: onOpenSettings },
            ],
          },
          { type: "divider" },
          {
            label: "Sign out",
            icon: <Glyph name="signOut" />,
            isDisabled: signOutDisabled,
            description: signOutDisabled ? "Wait for running work to finish" : undefined,
            onClick: onSignOut,
          },
        ]}
      />
    </HStack>
  );
}
