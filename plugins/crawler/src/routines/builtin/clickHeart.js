import {
  HEART_CLICK_HEART,
  HEART_CONFIRM_MS,
  HEART_FAIL_NOT_SAVED,
  HEART_FAIL_UNREAD,
  HEART_INNER,
  HEART_POLL_MS,
  HEART_READY_MS,
  HEART_SAVE_LABEL,
  heartAlreadySavedLog,
  heartFailedLog,
  heartRetryLog,
  heartSavedLog,
} from "./constants.js";
import { jobCardSelector, jobSaveSelector } from "./cssEscape.js";
import { isHeartSaved, isListCardSaved } from "./heart.js";
import { parseList } from "./parseList.js";
import { isSignedOutSession } from "./signedOut.js";

async function pollHeart({ jobId, call, rest, checkStopped, skipDelays, limitMs, wantSaved }) {
  let state = await call("shadow", {
    host: jobSaveSelector(jobId),
    inner: HEART_INNER,
    action: "query",
  });
  const ready = () => (wantSaved ? isHeartSaved(state) : Boolean(state?.found));
  if (ready() || skipDelays) return state;
  const deadline = Date.now() + limitMs;
  while (Date.now() < deadline) {
    checkStopped();
    await rest(HEART_POLL_MS);
    state = await call("shadow", {
      host: jobSaveSelector(jobId),
      inner: HEART_INNER,
      action: "query",
    });
    if (ready()) return state;
  }
  return state;
}

function noteHeart(onActivity, label, kind = "waitFor") {
  onActivity?.({ phase: "dismiss", label, kind });
}

function finishHeart(
  onActivity,
  log,
  { saved, alreadySaved = false, signedOut = false, warn = false },
) {
  noteHeart(onActivity, log);
  if (warn) console.warn(log);
  else if (alreadySaved) console.info(log);
  const result = { saved, log };
  if (alreadySaved) result.alreadySaved = true;
  if (signedOut) result.signedOut = true;
  return result;
}

/** After reload (or a successful save) Built In drops my-item and shows Saved. */
async function listCardAlreadySaved(readPage, jobId) {
  if (typeof readPage !== "function") return false;
  const page = await readPage();
  const parsed = parseList(page?.html || "", page?.url || "");
  const card = parsed.cards.find((item) => String(item.id) === String(jobId));
  if (!card) return false;
  return isListCardSaved({
    hasSaveHost: card.hasSaveHost,
    hasVisibleSavedBadge: card.hasVisibleSavedBadge,
  });
}

/**
 * Scroll the card into view, wait for my-item + open shadow + div.heart, click
 * once, wait up to 5s for saved, and retry one click only if still unsaved.
 * Re-read the heart before the retry click and skip it if already saved.
 * A missing host with a visible Saved badge is already saved (info, not warn).
 */
export async function saveListCardHeart({
  jobId,
  call,
  rest,
  checkStopped,
  skipDelays = false,
  onActivity,
  readPage,
}) {
  await call("scroll", { selector: jobCardSelector(jobId) });
  const ready = await pollHeart({
    jobId,
    call,
    rest,
    checkStopped,
    skipDelays,
    limitMs: HEART_READY_MS,
    wantSaved: false,
  });
  if (isHeartSaved(ready)) {
    return finishHeart(onActivity, heartAlreadySavedLog(jobId), {
      saved: true,
      alreadySaved: true,
    });
  }
  if (!ready?.found) {
    if (await listCardAlreadySaved(readPage, jobId)) {
      return finishHeart(onActivity, heartAlreadySavedLog(jobId), {
        saved: true,
        alreadySaved: true,
      });
    }
    return finishHeart(onActivity, heartFailedLog(HEART_FAIL_UNREAD, jobId), {
      saved: false,
      warn: true,
    });
  }

  const host = jobSaveSelector(jobId);
  noteHeart(onActivity, HEART_SAVE_LABEL, "click");
  await call("highlight", { selector: host });
  await call("shadow", { host, inner: HEART_INNER, action: "click", which: HEART_CLICK_HEART });

  const confirmSaved = async (log) => {
    const after = await pollHeart({
      jobId,
      call,
      rest,
      checkStopped,
      skipDelays,
      limitMs: HEART_CONFIRM_MS,
      wantSaved: true,
    });
    if (isHeartSaved(after)) {
      return finishHeart(onActivity, log, { saved: true });
    }
    if (await listCardAlreadySaved(readPage, jobId)) {
      return finishHeart(onActivity, heartAlreadySavedLog(jobId), {
        saved: true,
        alreadySaved: true,
      });
    }
    return null;
  };

  const first = await confirmSaved(heartSavedLog(jobId));
  if (first) return first;
  if (isSignedOutSession({ html: (await readPage()).html })) {
    return { saved: false, log: heartRetryLog(jobId), signedOut: true };
  }

  const beforeRetry = await call("shadow", {
    host,
    inner: HEART_INNER,
    action: "query",
  });
  if (isHeartSaved(beforeRetry) || (await listCardAlreadySaved(readPage, jobId))) {
    const already = !isHeartSaved(beforeRetry);
    return finishHeart(onActivity, already ? heartAlreadySavedLog(jobId) : heartSavedLog(jobId), {
      saved: true,
      alreadySaved: already,
    });
  }

  const retryLog = heartRetryLog(jobId);
  noteHeart(onActivity, retryLog);
  console.info(retryLog);
  await call("shadow", { host, inner: HEART_INNER, action: "click", which: HEART_CLICK_HEART });
  const retried = await confirmSaved(heartSavedLog(jobId));
  if (retried) return retried;
  if (isSignedOutSession({ html: (await readPage()).html })) {
    return finishHeart(onActivity, heartFailedLog(HEART_FAIL_NOT_SAVED, jobId), {
      saved: false,
      signedOut: true,
    });
  }
  return finishHeart(onActivity, heartFailedLog(HEART_FAIL_NOT_SAVED, jobId), {
    saved: false,
    warn: true,
  });
}
