import { ACORN_FACE_CHIP_PX } from "../acorn-face/constants";

export const CHIP_SIZE_PX = ACORN_FACE_CHIP_PX;
const POPOVER_WIDTH_PX = 280;
const POPOVER_MAX_HEIGHT_PX = 240;

/** Page overlay cannot use sidebar CSS variables; mirror tokens.md. */
const COLOR = {
  canvas: "#ffffff",
  text: "#0d0d0d",
  textSecondary: "#5d5d5d",
  textMuted: "#8e8e8e",
  border: "#dedede",
  brand: "#1f6feb",
  brandStrong: "#1556b8",
  danger: "#c0362c",
  shadow: "0 12px 32px rgb(13 13 13 / 8%)",
  font: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
} as const;

function overlayCss(): string {
  return `
    :host { all: initial; }
    .wrap {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
      pointer-events: auto;
    }
    .chip {
      display: flex;
      align-items: center;
      justify-content: center;
      width: ${CHIP_SIZE_PX}px;
      height: ${CHIP_SIZE_PX}px;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      cursor: pointer;
    }
    .chip:hover { opacity: 0.88; }
    .chip svg {
      width: ${CHIP_SIZE_PX}px;
      height: ${CHIP_SIZE_PX}px;
    }
    .popover {
      display: none;
      width: ${POPOVER_WIDTH_PX}px;
      max-height: ${POPOVER_MAX_HEIGHT_PX}px;
      flex-direction: column;
      gap: 8px;
      padding: 12px;
      background: ${COLOR.canvas};
      color: ${COLOR.text};
      border: 1px solid ${COLOR.border};
      border-radius: 16px;
      box-shadow: ${COLOR.shadow};
      font-family: ${COLOR.font};
    }
    .popover.is-open { display: flex; }
    .title {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    .status {
      margin: 0;
      font-size: 12px;
      color: ${COLOR.textSecondary};
      line-height: 1.4;
    }
    .status.is-error { color: ${COLOR.danger}; }
    .answer {
      display: none;
      margin: 0;
      max-height: 140px;
      overflow: auto;
      font: 14px/1.45 ${COLOR.font};
      white-space: pre-wrap;
      word-break: break-word;
      color: ${COLOR.text};
    }
    .answer.has-text { display: block; }
    .copy {
      align-self: flex-end;
      padding: 8px 16px;
      border: 0;
      border-radius: 999px;
      background: ${COLOR.brand};
      color: ${COLOR.canvas};
      font: 600 12px/1 ${COLOR.font};
      cursor: pointer;
    }
    .copy:hover { background: ${COLOR.brandStrong}; }
    .copy:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  `;
}

export function attachSheet(shadow: ShadowRoot): void {
  const css = overlayCss();
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    shadow.adoptedStyleSheets = [sheet];
  } catch {
    const style = document.createElement("style");
    style.textContent = css;
    shadow.append(style);
  }
}
