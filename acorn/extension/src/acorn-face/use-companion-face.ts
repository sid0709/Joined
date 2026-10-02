import { useEffect, useRef, useState } from "react";
import type { AcornFaceMode } from "@acorn/face";
import { FACE_AFK_MS, FACE_EMPTY_SLEEP_MS, FACE_SMILE_MS, FACE_THINK_GLANCE_MS } from "./constants";
import { resolveCompanionHold, mergeFaceShot, type CompanionFaceInput } from "./director";
import { subscribeAcornFaceFlash } from "./face-flash";

export function useCompanionFace(
  input: Omit<CompanionFaceInput, "afk" | "emptyIdle">,
): AcornFaceMode {
  const [afk, setAfk] = useState(false);
  const [emptyIdle, setEmptyIdle] = useState(false);
  const [shot, setShot] = useState<AcornFaceMode | null>(null);
  const [firstGlance, setFirstGlance] = useState(true);
  const signedInRef = useRef(input.signedIn);

  useEffect(() => {
    if (!input.signedIn) return undefined;
    if (!signedInRef.current && input.signedIn) {
      setShot("smile");
      const smile = window.setTimeout(() => setShot(null), FACE_SMILE_MS);
      signedInRef.current = true;
      const glance = window.setTimeout(() => setFirstGlance(false), FACE_THINK_GLANCE_MS);
      return () => {
        window.clearTimeout(smile);
        window.clearTimeout(glance);
      };
    }
    signedInRef.current = true;
    const glance = window.setTimeout(() => setFirstGlance(false), FACE_THINK_GLANCE_MS);
    return () => window.clearTimeout(glance);
  }, [input.signedIn]);

  useEffect(() => {
    return subscribeAcornFaceFlash((flash) => {
      setShot(flash.mode);
      window.setTimeout(() => setShot(null), flash.ms);
    });
  }, []);

  useEffect(() => {
    const busy =
      input.focused.fillPhase === "fetching" ||
      input.focused.fillPhase === "analyzing" ||
      input.focused.fillPhase === "running" ||
      input.qaBusy ||
      input.authBusy ||
      input.opening ||
      input.marking ||
      input.anyTabWorking;
    if (busy) {
      setAfk(false);
      return undefined;
    }
    let timer = window.setTimeout(() => setAfk(true), FACE_AFK_MS);
    const bump = () => {
      setAfk(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setAfk(true), FACE_AFK_MS);
    };
    const opts: AddEventListenerOptions = { capture: true };
    window.addEventListener("pointerdown", bump, opts);
    window.addEventListener("keydown", bump, opts);
    window.addEventListener("scroll", bump, opts);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", bump, opts);
      window.removeEventListener("keydown", bump, opts);
      window.removeEventListener("scroll", bump, opts);
    };
  }, [
    input.focused.fillPhase,
    input.qaBusy,
    input.authBusy,
    input.opening,
    input.marking,
    input.anyTabWorking,
  ]);

  useEffect(() => {
    if (!input.jobsEmpty || !input.signedIn) {
      setEmptyIdle(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setEmptyIdle(true), FACE_EMPTY_SLEEP_MS);
    return () => window.clearTimeout(timer);
  }, [input.jobsEmpty, input.signedIn]);

  const hold = resolveCompanionHold({ ...input, afk, emptyIdle });
  const glance = firstGlance && input.signedIn && hold === "waiting" ? "thinking" : hold;
  return mergeFaceShot(glance, shot);
}
