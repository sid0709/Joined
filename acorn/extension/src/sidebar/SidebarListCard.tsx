import { type ReactNode } from "react";
import type { AcornFaceMode } from "@acorn/face";
import { Card, Glyph, HStack, IconButton, Text, VStack } from "@joined/design-system";
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
  children?: ReactNode;
};

function CardIconButton({ action, glyph }: { action: SidebarListCardAction; glyph: ReactNode }) {
  return (
    <IconButton
      variant="ghost"
      size="sm"
      icon={glyph}
      label={action.label}
      tooltip={action.title}
      isDisabled={action.disabled}
      onClick={action.onClick}
    />
  );
}

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
  children,
}: SidebarListCardProps) {
  return (
    <Card
      data-item-id={itemId}
      variant={selected ? "blue" : "default"}
      padding={3}
      className={`acorn-list-card${attached && !selected ? " attached" : ""}${
        marking ? " marking" : ""
      }${blocked ? " is-blocked" : ""}`}
    >
      <button
        type="button"
        className="acorn-list-card-hit"
        disabled={open.disabled}
        aria-current={open.current ? "page" : undefined}
        aria-label={open.label}
        title={open.title}
        onClick={open.onClick}
      />
      <HStack gap={3} align="center">
        <ListCardMark
          itemId={itemId}
          logoUrl={logoUrl}
          fallback={logoFallback}
          faceMode={faceMode}
          selected={selected}
          label={`${title} status`}
        />
        <VStack gap={0} className="acorn-list-card-copy">
          <Text weight="semibold" maxLines={1} hasTruncateTooltip>
            {title}
          </Text>
          <Text type="supporting" maxLines={1}>
            {subtitle}
          </Text>
          <Text
            type="supporting"
            color={resumeReady ? "primary" : "secondary"}
            className={resumeFailed ? "acorn-list-card-failed" : undefined}
            maxLines={1}
          >
            {resumeText}
          </Text>
        </VStack>
        <HStack gap={0.5} className="acorn-list-card-actions">
          <CardIconButton action={download} glyph={<Glyph name="download" />} />
          <CardIconButton action={preview} glyph={<Glyph name="eye" />} />
          <CardIconButton action={check} glyph={<Glyph name="check" />} />
        </HStack>
      </HStack>
      {children}
    </Card>
  );
}
