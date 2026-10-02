import { useEffect, useRef } from "react";
import { mount, type BashFaceHandle, type BashFaceMode } from "@bash/face";

type BashFaceViewProps = {
  mode: BashFaceMode;
  size: number;
  live?: boolean;
  className?: string;
  label?: string;
};

export function BashFaceView({
  mode,
  size,
  live = true,
  className,
  label = "Bash face",
}: BashFaceViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<BashFaceHandle | null>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return undefined;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const face = mount(el, { size, reducedMotion: reduce });
    faceRef.current = face;
    return () => {
      face.destroy();
      faceRef.current = null;
    };
  }, [size]);

  useEffect(() => {
    faceRef.current?.setMode(mode);
  }, [mode]);

  useEffect(() => {
    faceRef.current?.setPaused(!live);
  }, [live]);

  return <div ref={hostRef} className={className} role="img" aria-label={`${label}, ${mode}`} />;
}
