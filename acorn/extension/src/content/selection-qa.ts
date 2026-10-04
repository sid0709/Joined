import { mount, type AcornFaceHandle } from "@acorn/face";
import { FACE_SMILE_MS, FACE_WINK_MS } from "../acorn-face/constants";
import { CHIP_SIZE_PX, attachSheet } from "./selection-qa-style";
import { requestSelectionQa } from "./selection-qa-request";

const MIN_SELECTION_CHARS = 8;
const MAX_SELECTION_CHARS = 8000;
const CHIP_OFFSET_PX = 8;
const VIEWPORT_PAD_PX = 4;
const OVERLAY_Z_INDEX = 2_147_483_646;
const COPIED_MS = 1500;
const HOST_ID = "acorn-selection-qa-host";

type OverlayState = {
  host: HTMLElement;
  shadow: ShadowRoot;
  wrap: HTMLDivElement;
  chip: HTMLButtonElement;
  popover: HTMLDivElement;
  status: HTMLParagraphElement;
  answer: HTMLPreElement;
  copyBtn: HTMLButtonElement;
  face: AcornFaceHandle | null;
  question: string;
  popoverOpen: boolean;
  busy: boolean;
  copiedTimer: number;
};

let overlay: OverlayState | null = null;
let mouseDown = false;

function ensureOverlay(): OverlayState {
  if (overlay?.host.isConnected) return overlay;
  overlay?.host.remove();

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.setAttribute("data-acorn-inject", "true");
  host.style.cssText = [
    "position:fixed",
    "top:0",
    "left:0",
    `z-index:${OVERLAY_Z_INDEX}`,
    "pointer-events:auto",
  ].join(";");

  const shadow = host.attachShadow({ mode: "closed" });
  attachSheet(shadow);

  const wrap = document.createElement("div");
  wrap.className = "wrap";

  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "chip";
  chip.title = "Ask Acorn";
  chip.setAttribute("aria-label", "Ask Acorn about this selection");
  const faceHost = document.createElement("span");
  faceHost.style.cssText = `display:flex;width:${CHIP_SIZE_PX}px;height:${CHIP_SIZE_PX}px;line-height:0;`;
  chip.append(faceHost);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const face = mount(faceHost, { size: CHIP_SIZE_PX, reducedMotion: reduce });
  face.setMode("waiting");

  const popover = document.createElement("div");
  popover.className = "popover";
  popover.setAttribute("role", "dialog");
  popover.setAttribute("aria-label", "Acorn Q&A");

  const title = document.createElement("p");
  title.className = "title";
  title.textContent = "Acorn";

  const status = document.createElement("p");
  status.className = "status";

  const answer = document.createElement("pre");
  answer.className = "answer";

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "copy";
  copyBtn.textContent = "Copy";
  copyBtn.disabled = true;

  popover.append(title, status, answer, copyBtn);
  wrap.append(chip, popover);
  shadow.append(wrap);
  document.documentElement.append(host);

  const state: OverlayState = {
    host,
    shadow,
    wrap,
    chip,
    popover,
    status,
    answer,
    copyBtn,
    face,
    question: "",
    popoverOpen: false,
    busy: false,
    copiedTimer: 0,
  };
  overlay = state;

  chip.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  chip.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    state.face?.setMode("wink");
    window.setTimeout(() => {
      if (overlay === state && !state.busy) state.face?.setMode("waiting");
    }, FACE_WINK_MS);
    void openPopover(state);
  });
  copyBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void copyAnswer(state);
  });

  return state;
}

function hideOverlay(): void {
  if (!overlay) return;
  if (overlay.copiedTimer) window.clearTimeout(overlay.copiedTimer);
  overlay.face?.destroy();
  overlay.host.remove();
  overlay = null;
}

function placeWrap(state: OverlayState, rect: DOMRect): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = rect.right + CHIP_OFFSET_PX;
  let top = rect.top;
  if (left + CHIP_SIZE_PX > vw - VIEWPORT_PAD_PX) {
    left = rect.left - CHIP_SIZE_PX - CHIP_OFFSET_PX;
  }
  left = Math.min(
    Math.max(VIEWPORT_PAD_PX, left),
    Math.max(VIEWPORT_PAD_PX, vw - CHIP_SIZE_PX - VIEWPORT_PAD_PX),
  );
  top = Math.min(
    Math.max(VIEWPORT_PAD_PX, top),
    Math.max(VIEWPORT_PAD_PX, vh - CHIP_SIZE_PX - VIEWPORT_PAD_PX),
  );
  state.host.style.left = `${Math.round(left)}px`;
  state.host.style.top = `${Math.round(top)}px`;
}

function readSelection(): { text: string; rect: DOMRect } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const raw = sel.toString().replace(/\s+/g, " ").trim();
  if (raw.length < MIN_SELECTION_CHARS) return null;
  const range = sel.getRangeAt(sel.rangeCount - 1);
  if (overlay && range.intersectsNode(overlay.host)) return null;
  const rects = range.getClientRects();
  const rect = rects[rects.length - 1] ?? range.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0 && raw.length === 0)) {
    return null;
  }
  return { text: raw.slice(0, MAX_SELECTION_CHARS), rect };
}

function syncChipFromSelection(): void {
  if (overlay?.popoverOpen || overlay?.busy) return;
  const next = readSelection();
  if (!next) {
    hideOverlay();
    return;
  }
  const state = ensureOverlay();
  state.question = next.text;
  placeWrap(state, next.rect);
}

function setPopoverStatus(
  state: OverlayState,
  text: string,
  kind: "info" | "error" = "info",
): void {
  state.status.textContent = text;
  state.status.classList.toggle("is-error", kind === "error");
  state.status.hidden = !text;
}

async function openPopover(state: OverlayState): Promise<void> {
  const question = state.question.trim();
  if (!question || state.busy) return;
  state.popoverOpen = true;
  state.popover.classList.add("is-open");
  state.answer.textContent = "";
  state.answer.classList.remove("has-text");
  state.copyBtn.disabled = true;
  state.copyBtn.textContent = "Copy";
  state.busy = true;
  state.face?.setMode("thinking");
  setPopoverStatus(state, "Writing…");
  const result = await requestSelectionQa(question);
  if (overlay !== state) return;
  state.busy = false;
  if (!result.ok || !result.answer) {
    state.face?.setMode("sad");
    setPopoverStatus(state, result.error || "Couldn’t write an answer.", "error");
    return;
  }
  state.face?.setMode("waiting");
  setPopoverStatus(state, "");
  state.answer.textContent = result.answer;
  state.answer.classList.add("has-text");
  state.copyBtn.disabled = false;
}

async function copyAnswer(state: OverlayState): Promise<void> {
  const text = state.answer.textContent?.trim() ?? "";
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    state.copyBtn.textContent = "Copied";
    state.face?.setMode("smile");
    if (state.copiedTimer) window.clearTimeout(state.copiedTimer);
    state.copiedTimer = window.setTimeout(
      () => {
        state.copyBtn.textContent = "Copy";
        state.copiedTimer = 0;
        if (overlay === state) state.face?.setMode("waiting");
      },
      Math.max(COPIED_MS, FACE_SMILE_MS),
    );
  } catch {
    setPopoverStatus(state, "Couldn’t copy.", "error");
    state.face?.setMode("sad");
  }
}

function eventInOverlay(event: Event): boolean {
  return Boolean(overlay && event.target === overlay.host);
}

let listenersBound = false;

export function initSelectionQa(): void {
  if (listenersBound) return;
  listenersBound = true;
  document.addEventListener(
    "mousedown",
    (event) => {
      mouseDown = true;
      if (eventInOverlay(event)) return;
      if (overlay?.popoverOpen && !overlay.busy) hideOverlay();
    },
    true,
  );
  document.addEventListener(
    "mouseup",
    (event) => {
      mouseDown = false;
      if (eventInOverlay(event)) return;
      window.queueMicrotask(syncChipFromSelection);
    },
    true,
  );
  document.addEventListener("selectionchange", () => {
    if (mouseDown) return;
    syncChipFromSelection();
  });
  document.addEventListener(
    "keyup",
    (event) => {
      if (event.key === "Escape") {
        hideOverlay();
        return;
      }
      syncChipFromSelection();
    },
    true,
  );
  window.addEventListener(
    "scroll",
    () => {
      if (overlay?.popoverOpen) return;
      hideOverlay();
    },
    true,
  );
}
