import { useState } from "react";
import type { AcornFaceMode } from "@acorn/face";
import { AcornFaceBadge } from "./AcornFaceBadge";

type ListCardMarkProps = {
  itemId: string;
  logoUrl?: string;
  fallback: string;
  faceMode: AcornFaceMode;
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
      <AcornFaceBadge mode={faceMode} selected={selected} label={label} />
    </span>
  );
}
