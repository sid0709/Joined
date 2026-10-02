import { type ReactNode } from "react";
import type { AcornFaceMode } from "@acorn/face";
import { ListCardMark } from "../acorn-face/ListCardMark";
import { CheckIcon, DownloadIcon, EyeIcon } from "./sidebar-icons";

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

function CardIconButton({
  className,
  action,
  children,
}: {
  className: string;
  action: SidebarListCardAction;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      disabled={action.disabled}
      title={action.title}
      aria-label={action.label}
      onClick={action.onClick}
    >
      {children}
    </button>
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
    <div
      data-item-id={itemId}
      className={`worker-pool-item fill-job${selected ? " selected" : ""}${
        attached && !selected ? " attached" : ""
      }${marking ? " marking" : ""}${blocked ? " is-blocked" : ""}`}
    >
      <button
        type="button"
        className="worker-pool-card-hit"
        disabled={open.disabled}
        aria-current={open.current ? "page" : undefined}
        aria-label={open.label}
        title={open.title}
        onClick={open.onClick}
      />
      <div className="worker-pool-open">
        <ListCardMark
          itemId={itemId}
          logoUrl={logoUrl}
          fallback={logoFallback}
          faceMode={faceMode}
          selected={selected}
          label={`${title} status`}
        />
        <span className="job-list-copy">
          <strong className="worker-pool-title" title={title}>
            {title}
          </strong>
          <span className="worker-pool-company" title={subtitle}>
            {subtitle}
          </span>
          <span
            className={`worker-pool-resume${
              resumeReady ? "" : resumeFailed ? " is-failed" : " muted"
            }`}
            title={resumeText}
          >
            {resumeText}
          </span>
        </span>
      </div>
      <div className="worker-pool-actions">
        <CardIconButton className="worker-pool-icon-btn" action={download}>
          <DownloadIcon />
        </CardIconButton>
        <CardIconButton className="worker-pool-icon-btn" action={preview}>
          <EyeIcon />
        </CardIconButton>
        <CardIconButton className="worker-pool-applied" action={check}>
          <CheckIcon />
        </CardIconButton>
      </div>
      {children}
    </div>
  );
}
