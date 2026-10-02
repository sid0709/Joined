import { useEffect, useRef, useState } from "react";
import type { AcornFaceMode } from "@acorn/face";
import type { PipelinePhase } from "@acorn/shared/pipeline-types";
import type { CustomGenerateStatus } from "../tab-custom-session";
import { FACE_SMILE_MS, FACE_WINK_MS } from "./constants";
import { mergeFaceShot } from "./director";

/** Smile once when fill or generate completes. */
export function useCompletionSmile(input: {
  hold: AcornFaceMode;
  fillPhase?: PipelinePhase | null;
  generateStatus?: CustomGenerateStatus | null;
  winkToken?: number;
}): AcornFaceMode {
  const [shot, setShot] = useState<AcornFaceMode | null>(null);
  const prevFill = useRef(input.fillPhase);
  const prevGen = useRef(input.generateStatus);
  const prevWink = useRef(input.winkToken);

  useEffect(() => {
    const fill = input.fillPhase;
    if (prevFill.current !== "done" && fill === "done") {
      setShot("smile");
      const timer = window.setTimeout(() => setShot(null), FACE_SMILE_MS);
      prevFill.current = fill;
      return () => window.clearTimeout(timer);
    }
    prevFill.current = fill;
    return undefined;
  }, [input.fillPhase]);

  useEffect(() => {
    const gen = input.generateStatus;
    if (prevGen.current !== "completed" && gen === "completed") {
      setShot("smile");
      const timer = window.setTimeout(() => setShot(null), FACE_SMILE_MS);
      prevGen.current = gen;
      return () => window.clearTimeout(timer);
    }
    prevGen.current = gen;
    return undefined;
  }, [input.generateStatus]);

  useEffect(() => {
    const token = input.winkToken;
    if (token && token !== prevWink.current) {
      prevWink.current = token;
      setShot("wink");
      const timer = window.setTimeout(() => setShot(null), FACE_WINK_MS);
      return () => window.clearTimeout(timer);
    }
    prevWink.current = token;
    return undefined;
  }, [input.winkToken]);

  return mergeFaceShot(input.hold, shot);
}
