import { useState } from "react";
import type { BashFaceMode } from "@bash/face";
import { BashFaceBadge } from "./BashFaceBadge";

type ListCardMarkProps = {
  itemId: string;
  logoUrl?: string;
  fallback: string;
  faceMode: BashFaceMode;
  selected: boolean;
  label: string;
};

function ListCardLogo({ logoUrl, fallback }: { logoUrl?: string; fallback: string }) {
  const [failedUrl, setFailedUrl] = useState("");
  const initial = fallback.trim().charAt(0).toUpperCase() || "?";
  const showImg = Boolean(logoUrl) && failedUrl !== logoUrl;

  return (
    <span className="list-card-mark-logo" aria-hidden="true">
      {showImg ? (
        <img
          src={logoUrl}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(logoUrl || "")}
        />
      ) : (
        <span className="list-card-mark-fallback">{initial}</span>
      )}
    </span>
  );
}

export function ListCardMark({ logoUrl, fallback, faceMode, selected, label }: ListCardMarkProps) {
  return (
    <span className="list-card-mark">
      <ListCardLogo logoUrl={logoUrl} fallback={fallback} />
      <BashFaceBadge mode={faceMode} selected={selected} label={label} />
    </span>
  );
}
