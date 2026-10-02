import { useEffect, useRef } from "react";
import { mount, type OakFaceHandle, type OakFaceMode } from "@oak/face";

type OakFaceViewProps = {
  mode: OakFaceMode;
  size: number;
  live?: boolean;
  className?: string;
  label?: string;
};

export function OakFaceView({
  mode,
  size,
  live = true,
  className,
  label = "Oak face",
}: OakFaceViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<OakFaceHandle | null>(null);

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
