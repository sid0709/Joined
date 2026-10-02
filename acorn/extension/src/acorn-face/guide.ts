import type { AcornFaceMode } from "@acorn/face";

export const ACORN_FACE_GUIDE: {
  mode: AcornFaceMode;
  title: string;
  detail: string;
}[] = [
  { mode: "waiting", title: "Ready", detail: "Idle, watching the list." },
  { mode: "thinking", title: "Reading", detail: "Analyzing the page or extracting a job." },
  { mode: "working", title: "Filling", detail: "Filling the form or generating a résumé." },
  {
    mode: "help",
    title: "Needs you",
    detail: "A step is blocked or a résumé pick needs your call.",
  },
  { mode: "smile", title: "Done", detail: "A fill, generate, or copy just succeeded." },
  { mode: "wink", title: "Courtesy", detail: "Remembered a tab, reconnected, or a small thanks." },
  { mode: "sad", title: "Stuck", detail: "An error, empty list, or a skipped résumé." },
  { mode: "sleeping", title: "Away", detail: "Signed out, AFK, or the tab is in the background." },
];
