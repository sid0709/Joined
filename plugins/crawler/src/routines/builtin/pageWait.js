import { queryAll, queryOne } from "../../routineKit/extract.js";
import { observeUntil } from "../../routineKit/observeUntil.js";

import {
  BUILTIN_ORIGIN,
  CLOAK_ATTR,
  JOB_CARD,
  JOB_CARD_ID_PREFIX,
  JOB_CARD_TITLE,
  JOB_POST_INIT_NAME,
  JSON_LD_SCRIPT,
  SAVE_HOST,
  TITLE_HEADING,
  WAIT_UNTIL,
} from "./constants.js";
import { isJobDetailReady } from "./detailReady.js";
import { heartStateFromRoot, isHeartSaved, isListCardSaved } from "./heart.js";
import { textOf } from "./html.js";
import { cardIdKey } from "./lists.js";
import { jobIdFromCard, parseJobCard } from "./parseList.js";

/*
 * Live-DOM checks for the content script's `builtinWait` op. Each answers from the
 * page as it is now; observeUntil re-runs it on every mutation.
 */

function pageUrlOf(doc) {
  return doc?.location?.href || BUILTIN_ORIGIN;
}

function saveHostFor(doc, jobId) {
  const id = String(jobId);
  return queryAll(doc, SAVE_HOST).find((host) => host.getAttribute("entity-id") === id) ?? null;
}

/** Same shape as the `shadow` query op, plus `cardSaved` (my-item gone, Saved badge shown). */
export function heartWaitState(doc, jobId) {
  const root = saveHostFor(doc, jobId)?.shadowRoot ?? null;
  const { found, classes, prefix } = heartStateFromRoot(root);
  const card = doc.getElementById(`${JOB_CARD_ID_PREFIX}${jobId}`);
  const parsed = card ? parseJobCard(card, pageUrlOf(doc)) : null;
  return {
    found,
    open: Boolean(root),
    classes,
    prefix,
    cardSaved: Boolean(parsed) && isListCardSaved(parsed),
  };
}

/** isJobDetailReady over just the h1 and data scripts, never the whole page. */
export function detailReadyInDocument(doc) {
  const heading = queryOne(doc, TITLE_HEADING);
  if (!textOf(heading)) return false;
  const ld = queryAll(doc, JSON_LD_SCRIPT);
  if (!ld.length) return false;
  const init = queryAll(doc, "script").find((script) =>
    String(script.textContent || "").includes(JOB_POST_INIT_NAME),
  );
  if (!init) return false;
  return isJobDetailReady([init, ...ld, heading].map((node) => node.outerHTML).join("\n"));
}

/**
 * Cards are server-rendered; Alpine (x-cloak) and `my-item` hearts land later. Ready
 * once Alpine cleared x-cloak in the cards and `my-item` has upgraded (one heart
 * renders), so Saved badges and hearts read true. No cards means nothing to hydrate.
 */
export function listReadyInDocument(doc) {
  const cards = queryAll(doc, JOB_CARD);
  if (!cards.length) return true;
  if (cards.some((card) => queryOne(card, `[${CLOAK_ATTR}]`))) return false;
  const hosts = cards.flatMap((card) => queryAll(card, SAVE_HOST));
  return !hosts.length || hosts.some((host) => heartStateFromRoot(host.shadowRoot).found);
}

function saveHostRoots(doc) {
  return queryAll(doc, SAVE_HOST).map((host) => host.shadowRoot);
}

/** Same key as cardIdKey(parseList(...).cards), read off the live cards. */
export function listPageIds(doc) {
  const cards = queryAll(doc, JOB_CARD).map((card) => {
    const title = queryOne(card, JOB_CARD_TITLE);
    const alias = title?.getAttribute("data-alias") || title?.getAttribute("href") || "";
    return { id: jobIdFromCard(card, alias) };
  });
  return cardIdKey(cards);
}

const WAITS = {
  [WAIT_UNTIL.HEART]: ({ jobId }) => ({
    read: (doc) => heartWaitState(doc, jobId),
    done: (state) => state.found || state.cardSaved,
    roots: (doc) => [saveHostFor(doc, jobId)?.shadowRoot],
  }),
  [WAIT_UNTIL.HEART_SAVED]: ({ jobId }) => ({
    read: (doc) => heartWaitState(doc, jobId),
    done: (state) => isHeartSaved(state) || state.cardSaved,
    roots: (doc) => [saveHostFor(doc, jobId)?.shadowRoot],
  }),
  [WAIT_UNTIL.DETAIL]: () => ({
    read: (doc) => ({ ready: detailReadyInDocument(doc) }),
    done: (state) => state.ready,
  }),
  [WAIT_UNTIL.LIST_READY]: () => ({
    read: (doc) => ({ ready: listReadyInDocument(doc) }),
    done: (state) => state.ready,
    roots: saveHostRoots,
  }),
  [WAIT_UNTIL.LIST_CHANGE]: ({ previousPageIds = "" }) => ({
    read: (doc) => {
      const pageIds = listPageIds(doc);
      return {
        pageIds,
        url: pageUrlOf(doc),
        changed: Boolean(pageIds) && pageIds !== previousPageIds,
      };
    },
    done: (state) => state.changed,
  }),
};

/**
 * Wait in the page until `until` holds or `timeoutMs` passes. Always answers with
 * `{ until, matched, immediate, ...state }` so the side panel can tell an answer
 * from a content script that does not know this op.
 */
export async function runBuiltinWait(doc, { until, timeoutMs = 0, ...args } = {}) {
  const make = WAITS[until];
  if (!make) throw new Error(`Unknown Built In wait: ${until}`);
  const { read, done, roots } = make(args);
  const { value, matched, immediate } = await observeUntil(
    doc,
    (current) => {
      const state = read(current);
      return done(state) ? state : null;
    },
    { timeoutMs, roots, onTimeout: read },
  );
  return { ...value, until, matched, immediate };
}
