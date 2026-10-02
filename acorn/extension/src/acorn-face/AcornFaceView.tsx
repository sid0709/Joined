import { useEffect, useRef } from "react";
import { mount, type AcornFaceHandle, type AcornFaceMode } from "@acorn/face";

type AcornFaceViewProps = {
  mode: AcornFaceMode;
  size: number;
  live?: boolean;
  className?: string;
  label?: string;
};

export function AcornFaceView({
  mode,
  size,
  live = true,
  className,
  label = "Acorn face",
}: AcornFaceViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<AcornFaceHandle | null>(null);

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
