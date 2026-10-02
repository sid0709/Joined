const OVERLAY_ID = "acorn-highlight-overlay";
const STYLE_ID = "acorn-highlight-style";

let globalCleanup: (() => void) | null = null;

/** Outline the current fill target. Do not draw a metadata chip over the page. */
export function highlightElement(el: Element): void {
  clearHighlight();

  const doc = el.ownerDocument;
  const win = doc.defaultView || window;

  const overlay = doc.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.setAttribute("data-acorn-inject", "true");

  if (!doc.getElementById(STYLE_ID)) {
    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.setAttribute("data-acorn-inject", "true");
    style.textContent = `
      #${OVERLAY_ID} {
        position: fixed;
        pointer-events: none;
        z-index: 2147483644;
        border: 2px solid #1f6feb;
        border-radius: 8px;
        box-shadow: 0 0 0 3px rgb(31 111 235 / 16%);
        transition: top 0.15s, left 0.15s, width 0.15s, height 0.15s;
      }
    `;
    doc.documentElement.appendChild(style);
  }

  doc.documentElement.appendChild(overlay);

  const reposition = () => {
    const rect = el.getBoundingClientRect();
    overlay.style.top = `${rect.top}px`;
    overlay.style.left = `${rect.left}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
  };

  reposition();
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => reposition(), 350);

  win.addEventListener("scroll", reposition, true);
  win.addEventListener("resize", reposition);

  globalCleanup = () => {
    win.removeEventListener("scroll", reposition, true);
    win.removeEventListener("resize", reposition);
    doc.querySelectorAll('[data-acorn-inject="true"]').forEach((n) => n.remove());
  };
}

export function clearHighlight(): void {
  if (globalCleanup) {
    globalCleanup();
    globalCleanup = null;
  }

  document.querySelectorAll('[data-acorn-inject="true"]').forEach((n) => n.remove());
}
