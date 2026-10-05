import { type ReactNode } from "react";
import type { AcornFaceMode } from "@acorn/face";
import { Badge, Card, Glyph, HStack, IconButton, MoreMenu, Text, VStack } from "sid-ui";
import { ListCardMark } from "../acorn-face/ListCardMark";

export type SidebarListCardAction = {
  title: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

type SidebarListCardProps = {
  itemId: string;
  selected: boolean;
  attached?: boolean;
  blocked?: boolean;
  marking?: boolean;
  faceMode: AcornFaceMode;
  logoUrl?: string;
  logoFallback: string;
  title: string;
  subtitle: string;
  resumeText: string;
  resumeReady: boolean;
  resumeFailed?: boolean;
  open: SidebarListCardAction & { current?: boolean };
  download: SidebarListCardAction;
  preview: SidebarListCardAction;
  check: SidebarListCardAction;
  /** Run actions that only apply sometimes (Continue, Start over, View JD). */
  more?: SidebarListCardAction[];
  /** A generate or recommend run in flight, under the row. */
  progress?: ReactNode;
};

/**
 * One Fill job or Custom tab. The whole row opens or focuses its tab; Preview stays one
 * click away and everything else sits in the ⋯ menu.
 */
export function SidebarListCard({
  itemId,
  selected,
  attached = false,
  blocked = false,
  marking = false,
  faceMode,
  logoUrl,
  logoFallback,
  title,
  subtitle,
  resumeText,
  resumeReady,
  resumeFailed = false,
  open,
  download,
  preview,
  check,
  more = [],
  progress,
}: SidebarListCardProps) {
  const menuItems = [
    ...more.map((action) => ({
      label: action.label,
      description: action.title !== action.label ? action.title : undefined,
      isDisabled: action.disabled,
      onClick: action.onClick,
    })),
    ...(more.length ? [{ type: "divider" as const }] : []),
    {
      label: download.title,
      icon: <Glyph name="download" />,
      isDisabled: download.disabled,
      onClick: download.onClick,
    },
    {
      label: check.title,
      icon: <Glyph name="check" />,
      isDisabled: check.disabled,
      onClick: check.onClick,
    },
  ];

  return (
    <Card
      data-item-id={itemId}
      variant={selected ? "blue" : "default"}
      padding={3}
      className={`acorn-row${attached && !selected ? " attached" : ""}${
        marking ? " marking" : ""
      }${blocked ? " is-blocked" : ""}`}
    >
      <button
        type="button"
        className="acorn-row-hit"
        disabled={open.disabled}
        aria-current={open.current ? "page" : undefined}
        aria-label={open.label}
        title={open.title}
        onClick={open.onClick}
      />
      <VStack gap={2}>
        <HStack gap={3} align="center">
          <ListCardMark
            itemId={itemId}
            logoUrl={logoUrl}
            fallback={logoFallback}
            faceMode={faceMode}
            selected={selected}
            label={`${title} status`}
          />
          <VStack gap={1} className="acorn-row-copy">
            <Text weight="semibold" maxLines={1} hasTruncateTooltip>
              {title}
            </Text>
            <Text type="supporting" maxLines={1}>
              {subtitle}
            </Text>
            <span className="acorn-row-status">
              <Badge
                variant={resumeFailed ? "error" : resumeReady ? "green" : "neutral"}
                label={resumeText}
              />
            </span>
          </VStack>
          <HStack gap={0.5} className="acorn-row-actions">
            <IconButton
              variant="ghost"
              size="sm"
              icon={<Glyph name="eye" />}
              label={preview.label}
              tooltip={preview.title}
              isDisabled={preview.disabled}
              onClick={preview.onClick}
            />
            <MoreMenu
              label={`More for ${title}`}
              variant="ghost"
              size="sm"
              alignment="end"
              items={menuItems}
            />
          </HStack>
        </HStack>
        {progress ? <div className="acorn-row-progress">{progress}</div> : null}
      </VStack>
    </Card>
  );
}
