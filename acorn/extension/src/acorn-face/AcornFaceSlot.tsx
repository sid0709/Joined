import { useEffect, useRef, useState } from "react";
import type { AcornFaceMode } from "@acorn/face";
import { ACORN_FACE_BADGE_PX } from "./constants";
import { isLiveRowMode } from "./director";
import { AcornFaceView } from "./AcornFaceView";

type AcornFaceSlotProps = {
  mode: AcornFaceMode;
  selected?: boolean;
  size?: number;
  label?: string;
  /** When false, pause the engine even if the row is on screen. */
  live?: boolean;
};

export function AcornFaceSlot({
  mode,
  selected = false,
  size = ACORN_FACE_BADGE_PX,
  label,
  live: liveProp,
}: AcornFaceSlotProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [onScreen, setOnScreen] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([entry]) => setOnScreen(Boolean(entry?.isIntersecting)), {
      threshold: 0.15,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const live = liveProp !== false && onScreen && isLiveRowMode(mode, selected);

  return (
    <span
      ref={ref}
      className="acorn-face-slot"
      style={{ width: size, height: size }}
      aria-hidden={false}
    >
      <AcornFaceView mode={mode} size={size} live={live} label={label} />
    </span>
  );
}
