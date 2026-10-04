/* global chrome */
import { AUTOLANCER_HIGHLIGHT_CLASSES } from "./agentStyles";
import {
  AUTOFILL_MAX_DELAY,
  AUTOFILL_MIN_DELAY,
  DEFAULT_AUTOFILL_FALLBACK_TEXT,
  buildFieldContext,
  fetchAutofillAnswer,
  readJobDescription,
} from "./inputAutofill";
import { randomBetween, supportsSelectionRange, wait } from "./inputTyping";

const CURSOR_LOGO_SRC = chrome.runtime.getURL("icons/icon48.png");
const CURSOR_LOGO_ALT = "Avalon Scrapper";

export class AutolancerInputController {
  constructor(inputElement) {
    this.input = inputElement;
    this.isActive = false;
    this.cursor = null;
    this.mirror = null;
    this.caretMarker = document.createElement("span");
    this.caretMarker.textContent = "\u200b";
    this.isGenerating = false;
    this.generationToken = null;

    this.handleFocus = this.handleFocus.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.handleInput = this.handleInput.bind(this);
    this.handleSelectionChange = this.handleSelectionChange.bind(this);
    this.updateCursor = this.updateCursor.bind(this);
    this.handleMenuAction = this.handleMenuAction.bind(this);
    this.startGeneration = this.startGeneration.bind(this);

    this.init();
  }

  init() {
    if (!this.input) return;
    this.cursor = this.createCursor();
    this.mirror = document.createElement("div");
    this.mirror.className = AUTOLANCER_HIGHLIGHT_CLASSES.mirror;
    document.body.appendChild(this.mirror);

    this.input.classList.add(AUTOLANCER_HIGHLIGHT_CLASSES.input);
    this.input.addEventListener("focus", this.handleFocus);
    this.input.addEventListener("blur", this.handleBlur);
    this.input.addEventListener("input", this.handleInput);
    this.input.addEventListener("keyup", this.handleInput);
    this.input.addEventListener("click", this.handleInput);
    this.input.addEventListener("scroll", this.handleInput);
  }

  createCursor() {
    const cursor = document.createElement("div");
    cursor.className = AUTOLANCER_HIGHLIGHT_CLASSES.cursor;

    const logoWrapper = document.createElement("div");
    logoWrapper.className = AUTOLANCER_HIGHLIGHT_CLASSES.cursorLogoWrapper;

    const logo = document.createElement("img");
    logo.className = AUTOLANCER_HIGHLIGHT_CLASSES.cursorLogo;
    logo.src = CURSOR_LOGO_SRC;
    logo.alt = CURSOR_LOGO_ALT;
    logo.draggable = false;

    const menu = document.createElement("div");
    menu.className = AUTOLANCER_HIGHLIGHT_CLASSES.menu;

    const menuItem = document.createElement("div");
    menuItem.className = AUTOLANCER_HIGHLIGHT_CLASSES.menuItem;
    menuItem.textContent = "Autofill with AI";
    menuItem.addEventListener("mousedown", this.handleMenuAction);

    menu.appendChild(menuItem);
    logoWrapper.appendChild(logo);
    logoWrapper.appendChild(menu);

    logo.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.input?.focus();
    });

    cursor.appendChild(logoWrapper);
    document.body.appendChild(cursor);
    return cursor;
  }

  handleFocus() {
    this.isActive = true;
    this.cursor.style.display = "flex";
    this.updateCursor();
    document.addEventListener("selectionchange", this.handleSelectionChange);
    window.addEventListener("scroll", this.updateCursor, true);
    window.addEventListener("resize", this.updateCursor);
  }

  handleBlur() {
    // Delay hiding to allow menu clicks
    setTimeout(() => {
      if (document.activeElement !== this.input) {
        this.isActive = false;
        this.cursor.style.display = "none";
      }
    }, 150);

    document.removeEventListener("selectionchange", this.handleSelectionChange);
    window.removeEventListener("scroll", this.updateCursor, true);
    window.removeEventListener("resize", this.updateCursor);
  }

  handleInput() {
    if (!this.isActive) return;
    this.updateCursor();
  }

  handleSelectionChange() {
    if (!this.isActive || document.activeElement !== this.input) return;
    this.updateCursor();
  }

  handleMenuAction(event) {
    event.preventDefault();
    event.stopPropagation();
    this.input?.focus();
    this.emitGenerateEvent("start");
    this.startGeneration();
  }

  async startGeneration() {
    if (!this.input || this.isGenerating) return;
    this.isGenerating = true;
    const token = Symbol("autolancer-generation");
    this.generationToken = token;
    let textToType = "";

    // Start immediately (same feel as the previous demo autofill): clear + cursor update first.
    try {
      this.input.focus();
      this.input.value = "";
      this.dispatchInputEvent();
      this.updateCursor();

      const context = buildFieldContext(this.input);
      const jobDescription = await readJobDescription();
      textToType = await fetchAutofillAnswer(context, jobDescription);
    } catch (error) {
      console.error("Autofill with AI failed:", error);
      textToType = this.input.dataset.autolancerDemoText || DEFAULT_AUTOFILL_FALLBACK_TEXT;
    }

    try {
      await this.typeTextSequence(textToType, token);
      if (this.generationToken === token) {
        this.emitGenerateEvent("complete");
      }
    } finally {
      if (this.generationToken === token) {
        this.generationToken = null;
      }
      this.isGenerating = false;
    }
  }

  async typeTextSequence(text, token) {
    for (const char of text) {
      if (!this.input || this.generationToken !== token) {
        break;
      }
      this.input.value += char;
      const length = this.input.value.length;

      // Try to set cursor position if supported
      if (supportsSelectionRange(this.input)) {
        try {
          this.input.setSelectionRange(length, length);
        } catch {
          // Ignore specific browser errors for inputs that reject selection setting
        }
      }

      this.input.scrollLeft = this.input.scrollWidth;
      if (this.input instanceof HTMLTextAreaElement) {
        this.input.scrollTop = this.input.scrollHeight;
      }

      this.dispatchInputEvent();
      this.updateCursor();
      await wait(randomBetween(AUTOFILL_MIN_DELAY, AUTOFILL_MAX_DELAY));
    }
  }

  dispatchInputEvent() {
    if (!this.input) return;
    this.input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  emitGenerateEvent(stage = "start") {
    if (!this.input) return;
    const synthetic = new CustomEvent("autolancer-agent-generate", {
      bubbles: true,
      detail: {
        value: this.input.value ?? "",
        name: this.input.name || null,
        stage,
      },
    });
    this.input.dispatchEvent(synthetic);
  }

  updateCursor() {
    if (!this.isActive || !this.input?.isConnected) return;
    const rect = this.input.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      this.cursor.style.display = "none";
      return;
    }

    const computed = window.getComputedStyle(this.input);

    // Fallback for selection start
    let selectionStart = (this.input.value || "").length;
    try {
      if (typeof this.input.selectionStart === "number") {
        selectionStart = this.input.selectionStart;
      }
    } catch {
      /* ignore */
    }

    const value = this.input.value || "";
    const textBeforeCursor = value.substring(0, selectionStart);

    const paddingLeft = parseFloat(computed.paddingLeft) || 0;
    const paddingRight = parseFloat(computed.paddingRight) || 0;
    const borderLeft = parseFloat(computed.borderLeftWidth) || 0;
    const borderRight = parseFloat(computed.borderRightWidth) || 0;
    const contentWidth = Math.max(
      1,
      rect.width - borderLeft - borderRight - paddingLeft - paddingRight,
    );

    // Mirror setup
    const mirror = this.mirror;
    mirror.style.font = computed.font;
    mirror.style.lineHeight = computed.lineHeight;
    mirror.style.letterSpacing = computed.letterSpacing;
    mirror.style.textTransform = computed.textTransform;
    mirror.style.textAlign = computed.textAlign;
    const isTextarea = this.input instanceof HTMLTextAreaElement;
    mirror.style.whiteSpace = isTextarea ? "pre-wrap" : "pre";
    const wrapValue = isTextarea ? "break-word" : "normal";
    mirror.style.wordBreak = wrapValue;
    mirror.style.overflowWrap = wrapValue;
    mirror.style.width = `${contentWidth}px`;
    mirror.style.padding = "0";
    mirror.style.border = "0";

    mirror.textContent = "";
    if (textBeforeCursor) {
      mirror.appendChild(document.createTextNode(textBeforeCursor));
    }
    this.caretMarker.textContent = "\u200b";
    mirror.appendChild(this.caretMarker);

    const markerRect = this.caretMarker.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();

    const scrollLeft = this.input.scrollLeft || 0;
    const scrollTop = this.input.scrollTop || 0;

    const caretOffsetLeft = markerRect.left - mirrorRect.left;
    const caretOffsetTop = markerRect.top - mirrorRect.top;

    const paddingTop = parseFloat(computed.paddingTop) || 0;
    const borderTop = parseFloat(computed.borderTopWidth) || 0;

    const caretX = rect.left + borderLeft + paddingLeft + caretOffsetLeft - scrollLeft;
    const caretYTop = rect.top + borderTop + paddingTop + caretOffsetTop - scrollTop;

    const lineHeight = parseFloat(computed.lineHeight) || markerRect.height || 20;
    const caretCenterY = caretYTop + lineHeight / 2;

    const borderBottom = parseFloat(computed.borderBottomWidth) || 0;
    const clampedX = Math.max(rect.left + borderLeft, Math.min(rect.right - borderRight, caretX));
    const clampedY = Math.max(
      rect.top + borderTop,
      Math.min(rect.bottom - borderBottom, caretCenterY),
    );

    this.cursor.style.left = `${clampedX}px`;
    this.cursor.style.top = `${clampedY}px`;
    this.cursor.style.display = "flex";
  }

  cancelGeneration() {
    this.generationToken = null;
    this.isGenerating = false;
  }

  destroy() {
    this.cancelGeneration();
    this.handleBlur();
    if (this.cursor?.parentElement) {
      this.cursor.parentElement.removeChild(this.cursor);
    }
    if (this.mirror?.parentElement) {
      this.mirror.parentElement.removeChild(this.mirror);
    }
    this.cursor = null;
    this.mirror = null;

    if (this.input?.classList?.contains(AUTOLANCER_HIGHLIGHT_CLASSES.input)) {
      this.input.classList.remove(AUTOLANCER_HIGHLIGHT_CLASSES.input);
    }

    this.input?.removeEventListener("focus", this.handleFocus);
    this.input?.removeEventListener("blur", this.handleBlur);
    this.input?.removeEventListener("input", this.handleInput);
    this.input?.removeEventListener("keyup", this.handleInput);
    this.input?.removeEventListener("click", this.handleInput);
    this.input?.removeEventListener("scroll", this.handleInput);
  }
}
