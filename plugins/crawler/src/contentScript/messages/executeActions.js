/* global chrome */
import { performActionOnElement } from "../actionExecutor";
import { findElements, waitForElements } from "../elementFinder";

export async function handleExecuteAction(request) {
  try {
    const payload = request.payload || {};
    const { action, fetchType, identifier, componentType, propertyName, pattern } = payload;
    if (action === "fetch") {
      // Resolve target element(s)
      let elements = findElements(componentType, propertyName, pattern);
      if (!elements || elements.length === 0) {
        elements = await waitForElements(componentType, propertyName, pattern, 2000, 100);
      }
      if (!elements || elements.length === 0) {
        chrome.runtime.sendMessage({
          action: "fetchResult",
          payload: { identifier, success: false, error: "No elements found" },
        });
        return;
      }
      const idx = Number.isFinite(payload.order) ? Math.max(0, parseInt(payload.order, 10)) : 0;
      const el = elements[idx];
      let data;
      if (fetchType === "text") {
        data = el?.innerText ?? "";
      } else {
        // Default: return outerHTML so callers can parse and extract attributes
        data = el?.outerHTML ?? "";
      }
      chrome.runtime.sendMessage({
        action: "fetchResult",
        payload: { identifier, success: true, data },
      });
    } else {
      // Execute interactive actions (click/fill/typeSmoothly)
      await performActionOnElement(payload);
      // Optionally we could send an acknowledgement to UI if needed later
    }
  } catch (err) {
    console.error("executeAction error:", err);
  }
}

export async function handleExecuteActionsSequence(request) {
  const runId = request?.payload?.runId || null;
  const actions = Array.isArray(request?.payload?.actions) ? request.payload.actions : [];
  const results = [];

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    for (let i = 0; i < actions.length; i++) {
      const actionPayload = actions[i];
      const result = await performActionOnElement(actionPayload);
      results.push({ index: i, ...result });
      // Small pause between actions to allow DOM/framework updates to settle.
      await wait(75);
    }

    try {
      chrome.runtime.sendMessage({
        action: "executeActionsSequenceResult",
        payload: { runId, success: true, results },
      });
    } catch (err) {
      console.error("Failed to send executeActionsSequenceResult message:", err);
    }
  } catch (err) {
    console.error("executeActionsSequence error:", err);
    try {
      chrome.runtime.sendMessage({
        action: "executeActionsSequenceResult",
        payload: {
          runId,
          success: false,
          error: String((err && err.message) || err),
          results,
        },
      });
    } catch (e) {
      console.error("Failed to send executeActionsSequenceResult error message:", e);
    }
  }
}

export async function handleExecuteActionsParallel(request) {
  const runId = request?.payload?.runId || null;
  const actions = Array.isArray(request?.payload?.actions) ? request.payload.actions : [];

  try {
    const results = await Promise.all(
      actions.map(async (actionPayload, index) => {
        const result = await performActionOnElement(actionPayload);
        return { index, ...result };
      }),
    );

    try {
      chrome.runtime.sendMessage({
        action: "executeActionsParallelResult",
        payload: { runId, success: true, results },
      });
    } catch (err) {
      console.error("Failed to send executeActionsParallelResult message:", err);
    }
  } catch (err) {
    console.error("executeActionsParallel error:", err);
    try {
      chrome.runtime.sendMessage({
        action: "executeActionsParallelResult",
        payload: { runId, success: false, error: String((err && err.message) || err) },
      });
    } catch (e) {
      console.error("Failed to send executeActionsParallelResult error message:", e);
    }
  }
}
