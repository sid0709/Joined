import { useEffect, useRef, useState } from "react";
import type { OakFaceMode } from "@oak/face";
import { OAK_FACE_BADGE_PX } from "./constants";
import { isLiveRowMode } from "./director";
import { OakFaceView } from "./OakFaceView";

type OakFaceSlotProps = {
  mode: OakFaceMode;
  selected?: boolean;
  size?: number;
  label?: string;
  /** When false, pause the engine even if the row is on screen. */
  live?: boolean;
};

export function OakFaceSlot({
  mode,
  selected = false,
  size = OAK_FACE_BADGE_PX,
  label,
  live: liveProp,
}: OakFaceSlotProps) {
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
      className="oak-face-slot"
      style={{ width: size, height: size }}
      aria-hidden={false}
    >
      <OakFaceView mode={mode} size={size} live={live} label={label} />
    </span>
  );
}
