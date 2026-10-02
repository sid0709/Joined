import type { OakFaceMode } from "@oak/face";
import { OAK_FACE_BADGE_OVERHANG, OAK_FACE_BADGE_PX } from "./constants";
import { OakFaceSlot } from "./OakFaceSlot";

type OakFaceBadgeProps = {
  mode: OakFaceMode;
  selected?: boolean;
  label: string;
};

export function OakFaceBadge({ mode, selected = false, label }: OakFaceBadgeProps) {
  const shift = `${OAK_FACE_BADGE_OVERHANG * 100}%`;

  return (
    <span
      className="oak-face-badge"
      style={{
        width: OAK_FACE_BADGE_PX,
        height: OAK_FACE_BADGE_PX,
        transform: `translate(${shift}, ${shift})`,
      }}
    >
      <OakFaceSlot mode={mode} selected={selected} size={OAK_FACE_BADGE_PX} label={label} />
    </span>
  );
}
