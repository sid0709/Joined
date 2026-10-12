import {
  HEART_CLICK_HEART,
  HEART_CONFIRM_MS,
  HEART_FAIL_NOT_SAVED,
  HEART_FAIL_UNREAD,
  HEART_INNER,
  HEART_POLL_MS,
  HEART_READY_MS,
  HEART_SAVE_LABEL,
  heartFailedLog,
  heartRetryLog,
  heartSavedLog,
} from "./constants.js";
import { jobCardSelector, jobSaveSelector } from "./cssEscape.js";
import { isHeartSaved } from "./heart.js";
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

/**
 * Scroll the card into view, wait for my-item + open shadow + div.heart, click
 * once, wait up to 5s for saved, and retry one click only if still unsaved.
 * Re-read the heart before the retry click and skip it if already saved.
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
    const log = heartSavedLog(jobId);
    noteHeart(onActivity, log);
    return { saved: true, log };
  }
  if (!ready?.found) {
    const log = heartFailedLog(HEART_FAIL_UNREAD, jobId);
    noteHeart(onActivity, log);
    console.warn(log);
    return { saved: false, log };
  }

  const host = jobSaveSelector(jobId);
  noteHeart(onActivity, HEART_SAVE_LABEL, "click");
  await call("highlight", { selector: host });
  await call("shadow", { host, inner: HEART_INNER, action: "click", which: HEART_CLICK_HEART });

  let after = await pollHeart({
    jobId,
    call,
    rest,
    checkStopped,
    skipDelays,
    limitMs: HEART_CONFIRM_MS,
    wantSaved: true,
  });
  if (isHeartSaved(after)) {
    const log = heartSavedLog(jobId);
    noteHeart(onActivity, log);
    return { saved: true, log };
  }
  if (isSignedOutSession({ html: (await readPage()).html })) {
    return { saved: false, log: heartRetryLog(jobId), signedOut: true };
  }

  const beforeRetry = await call("shadow", {
    host,
    inner: HEART_INNER,
    action: "query",
  });
  if (isHeartSaved(beforeRetry)) {
    const log = heartSavedLog(jobId);
    noteHeart(onActivity, log);
    return { saved: true, log };
  }

  const retryLog = heartRetryLog(jobId);
  noteHeart(onActivity, retryLog);
  console.info(retryLog);
  await call("shadow", { host, inner: HEART_INNER, action: "click", which: HEART_CLICK_HEART });
  after = await pollHeart({
    jobId,
    call,
    rest,
    checkStopped,
    skipDelays,
    limitMs: HEART_CONFIRM_MS,
    wantSaved: true,
  });
  if (isHeartSaved(after)) {
    const log = heartSavedLog(jobId);
    noteHeart(onActivity, log);
    return { saved: true, log };
  }
  if (isSignedOutSession({ html: (await readPage()).html })) {
    return { saved: false, log: heartFailedLog(HEART_FAIL_NOT_SAVED, jobId), signedOut: true };
  }
  const log = heartFailedLog(HEART_FAIL_NOT_SAVED, jobId);
  noteHeart(onActivity, log);
  console.warn(log);
  return { saved: false, log };
}
