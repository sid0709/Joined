import { describe, expect, test } from "bun:test";
import { parseHTML } from "linkedom";

import { cancelObservers, observeUntil } from "./observeUntil.js";

const LONG_MS = 2_000;
const SHORT_MS = 30;
// Slower than any test, so only a MutationObserver can answer in time.
const NO_FALLBACK_MS = 60_000;

function page(body = "") {
  return parseHTML(`<html><body>${body}</body></html>`).document;
}

const find = (selector) => (doc) => doc.querySelector(selector);

describe("observeUntil", () => {
  test("answers at once when the node is already there", async () => {
    const doc = page('<div id="ready"></div>');
    const result = await observeUntil(doc, find("#ready"), { timeoutMs: LONG_MS });
    expect(result.matched).toBe(true);
    expect(result.immediate).toBe(true);
    expect(result.value.id).toBe("ready");
  });

  test("answers on the mutation that adds the node, not on a poll", async () => {
    const doc = page();
    const started = Date.now();
    const pending = observeUntil(doc, find("#late"), {
      timeoutMs: LONG_MS,
      fallbackMs: NO_FALLBACK_MS,
    });
    setTimeout(() => {
      const node = doc.createElement("div");
      node.id = "late";
      doc.body.appendChild(node);
    }, SHORT_MS);
    const result = await pending;
    expect(result.matched).toBe(true);
    expect(result.immediate).toBe(false);
    expect(Date.now() - started).toBeLessThan(LONG_MS);
  });

  test("sees changes inside a shadow root it was told to watch", async () => {
    const doc = page('<my-item id="host"></my-item>');
    const host = doc.getElementById("host");
    const root = host.attachShadow({ mode: "open" });
    const heart = doc.createElement("div");
    heart.className = "heart";
    root.appendChild(heart);
    const pending = observeUntil(doc, () => root.querySelector("div.heart.saved"), {
      timeoutMs: LONG_MS,
      roots: () => [host.shadowRoot],
      fallbackMs: NO_FALLBACK_MS,
    });
    setTimeout(() => heart.classList.add("saved"), SHORT_MS);
    await expect(pending).resolves.toMatchObject({ matched: true });
  });

  test("falls back to the in-page interval when no mutation fires", async () => {
    const doc = page();
    let ready = false;
    setTimeout(() => {
      ready = true;
    }, SHORT_MS);
    const result = await observeUntil(doc, () => ready && { ok: true }, {
      timeoutMs: LONG_MS,
      fallbackMs: 5,
    });
    expect(result).toEqual({ value: { ok: true }, matched: true, immediate: false });
  });

  test("returns onTimeout's state when time runs out", async () => {
    const doc = page();
    const result = await observeUntil(doc, find("#never"), {
      timeoutMs: SHORT_MS,
      onTimeout: () => ({ ready: false }),
    });
    expect(result).toEqual({ value: { ready: false }, matched: false, immediate: false });
    await expect(observeUntil(doc, find("#never"), { timeoutMs: 0 })).resolves.toEqual({
      value: null,
      matched: false,
      immediate: false,
    });
  });

  test("cancelObservers ends every in-flight wait", async () => {
    const doc = page();
    const pending = observeUntil(doc, find("#never"), { timeoutMs: LONG_MS });
    cancelObservers({ aborted: true });
    await expect(pending).resolves.toEqual({
      value: { aborted: true },
      matched: false,
      immediate: false,
    });
  });

  test("a throwing check counts as not ready", async () => {
    const doc = page();
    const result = await observeUntil(
      doc,
      () => {
        throw new Error("boom");
      },
      { timeoutMs: SHORT_MS },
    );
    expect(result.matched).toBe(false);
  });
});
