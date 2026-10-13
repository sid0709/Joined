import { describe, expect, test } from "bun:test";
import { parseHTML } from "linkedom";

import { CLOAK_ATTR, HEART_INNER, SAVE_HOST, WAIT_UNTIL } from "./constants.js";
import { isJobDetailReady } from "./detailReady.js";
import { cardIdKey } from "./lists.js";
import {
  detailReadyInDocument,
  heartWaitState,
  listPageIds,
  listReadyInDocument,
  runBuiltinWait,
} from "./pageWait.js";
import { parseList } from "./parseList.js";
import "./testing/domParser.js";
import { loadFixture } from "./testing/loadFixture.js";

const JOB_ID = "9256204";
const SAVED_JOB_ID = "22222222";
const LONG_MS = 2_000;
const SHORT_MS = 30;

function live(name) {
  return parseHTML(loadFixture(name)).document;
}

function hydrateHeart(doc, jobId, { saved = false } = {}) {
  const host = doc.querySelector(`${SAVE_HOST}[entity-id="${jobId}"]`);
  const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  const heart = doc.createElement("div");
  heart.className = saved ? "heart saved" : "heart";
  root.appendChild(heart);
  return root.querySelector(HEART_INNER);
}

function uncloak(doc) {
  for (const node of doc.querySelectorAll(`[${CLOAK_ATTR}]`)) node.removeAttribute(CLOAK_ATTR);
}

describe("detailReadyInDocument", () => {
  test("agrees with isJobDetailReady on the full page", () => {
    for (const name of ["detail-hpe.html", "detail-easyapply.html", "list.html"]) {
      const html = loadFixture(name);
      expect(detailReadyInDocument(parseHTML(html).document)).toBe(isJobDetailReady(html));
    }
    expect(detailReadyInDocument(live("detail-hpe.html"))).toBe(true);
  });
});

describe("listReadyInDocument", () => {
  test("waits for Alpine to clear x-cloak and for one my-item heart", () => {
    const doc = live("list.html");
    expect(listReadyInDocument(doc)).toBe(false);
    uncloak(doc);
    expect(listReadyInDocument(doc)).toBe(false);
    hydrateHeart(doc, JOB_ID);
    expect(listReadyInDocument(doc)).toBe(true);
  });

  test("a page with no cards has nothing to hydrate", () => {
    expect(listReadyInDocument(live("list-empty.html"))).toBe(true);
  });
});

describe("listPageIds", () => {
  test("matches cardIdKey(parseList(...).cards)", () => {
    for (const name of ["list.html", "list-saved.html", "list-last.html"]) {
      const html = loadFixture(name);
      expect(listPageIds(parseHTML(html).document)).toBe(cardIdKey(parseList(html).cards));
    }
  });
});

describe("heartWaitState", () => {
  test("reads the shadow heart like the shadow query op", () => {
    const doc = live("list.html");
    expect(heartWaitState(doc, JOB_ID)).toMatchObject({ found: false, open: false });
    hydrateHeart(doc, JOB_ID, { saved: true });
    expect(heartWaitState(doc, JOB_ID)).toMatchObject({
      found: true,
      open: true,
      classes: "heart saved",
      cardSaved: false,
    });
  });

  test("a card with no my-item and a visible Saved badge is cardSaved", () => {
    expect(heartWaitState(live("list-saved.html"), SAVED_JOB_ID)).toMatchObject({
      found: false,
      cardSaved: true,
    });
    expect(heartWaitState(live("list.html"), JOB_ID).cardSaved).toBe(false);
  });
});

describe("runBuiltinWait", () => {
  test("answers when the heart lands in my-item's shadow root", async () => {
    const doc = live("list.html");
    const pending = runBuiltinWait(doc, {
      until: WAIT_UNTIL.HEART,
      jobId: JOB_ID,
      timeoutMs: LONG_MS,
    });
    setTimeout(() => hydrateHeart(doc, JOB_ID), SHORT_MS);
    await expect(pending).resolves.toMatchObject({
      until: WAIT_UNTIL.HEART,
      matched: true,
      immediate: false,
      found: true,
    });
  });

  test("answers when the heart turns saved", async () => {
    const doc = live("list.html");
    const heart = hydrateHeart(doc, JOB_ID);
    const pending = runBuiltinWait(doc, {
      until: WAIT_UNTIL.HEART_SAVED,
      jobId: JOB_ID,
      timeoutMs: LONG_MS,
    });
    setTimeout(() => heart.classList.add("saved"), SHORT_MS);
    await expect(pending).resolves.toMatchObject({ matched: true, classes: "heart saved" });
  });

  test("answers when Next swaps the card set", async () => {
    const doc = live("list.html");
    const previousPageIds = listPageIds(doc);
    const pending = runBuiltinWait(doc, {
      until: WAIT_UNTIL.LIST_CHANGE,
      previousPageIds,
      timeoutMs: LONG_MS,
    });
    setTimeout(() => {
      doc.getElementById(`job-card-${JOB_ID}`).id = "job-card-22222222";
    }, SHORT_MS);
    const result = await pending;
    expect(result.matched).toBe(true);
    expect(result.pageIds).not.toBe(previousPageIds);
    expect(result.pageIds).toContain("22222222");
  });

  test("returns the last state, unmatched, after the timeout", async () => {
    const doc = live("list.html");
    await expect(
      runBuiltinWait(doc, { until: WAIT_UNTIL.DETAIL, timeoutMs: SHORT_MS }),
    ).resolves.toEqual({
      until: WAIT_UNTIL.DETAIL,
      matched: false,
      immediate: false,
      ready: false,
    });
  });

  test("rejects an unknown wait", async () => {
    await expect(runBuiltinWait(live("list.html"), { until: "nope" })).rejects.toThrow(
      "Unknown Built In wait: nope",
    );
  });
});
