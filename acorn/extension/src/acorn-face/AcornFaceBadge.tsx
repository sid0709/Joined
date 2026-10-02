import type { BashFaceMode } from "@bash/face";
import { BASH_FACE_BADGE_OVERHANG, BASH_FACE_BADGE_PX } from "./constants";
import { BashFaceSlot } from "./BashFaceSlot";

type BashFaceBadgeProps = {
  mode: BashFaceMode;
  selected?: boolean;
  label: string;
};

export function BashFaceBadge({ mode, selected = false, label }: BashFaceBadgeProps) {
  const shift = `${BASH_FACE_BADGE_OVERHANG * 100}%`;

  return (
    <span
      className="bash-face-badge"
      style={{
        width: BASH_FACE_BADGE_PX,
        height: BASH_FACE_BADGE_PX,
        transform: `translate(${shift}, ${shift})`,
      }}
    >
      <BashFaceSlot mode={mode} selected={selected} size={BASH_FACE_BADGE_PX} label={label} />
    </span>
  );
}
