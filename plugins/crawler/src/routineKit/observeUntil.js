/**
 * Page-side wait: resolve the moment `check(doc)` returns a value. A MutationObserver
 * re-checks on every DOM change, so there is no poll gap between the node landing
 * and the answer. Shadow roots and custom-element upgrades do not always produce a
 * mutation on `doc`, so `roots(doc)` adds shadow roots to observe as they appear and
 * a short in-page interval covers the rest.
 */

export const OBSERVE_FALLBACK_MS = 50;

const OBSERVE_OPTIONS = Object.freeze({
  childList: true,
  subtree: true,
  attributes: true,
  characterData: true,
});

const pending = new Set();

/** Resolve every in-flight wait with `result` (Stop must not sit out a long wait). */
export function cancelObservers(result) {
  for (const finish of [...pending]) finish(result);
}

function safeCheck(check, doc) {
  try {
    return check(doc) || null;
  } catch {
    return null;
  }
}

/**
 * @returns {Promise<{ value: any, matched: boolean, immediate: boolean }>}
 * `value` is the check result, or `onTimeout(doc)` (else null) when time ran out.
 */
export function observeUntil(
  doc,
  check,
  { timeoutMs = 0, roots, onTimeout, fallbackMs = OBSERVE_FALLBACK_MS } = {},
) {
  const first = safeCheck(check, doc);
  if (first) return Promise.resolve({ value: first, matched: true, immediate: true });
  const timedOut = () => ({ value: onTimeout?.(doc) ?? null, matched: false, immediate: false });
  if (!(timeoutMs > 0)) return Promise.resolve(timedOut());

  return new Promise((resolve) => {
    const watched = new Set();
    const Observer = doc?.defaultView?.MutationObserver ?? globalThis.MutationObserver;
    let observer = null;
    let fallback = null;
    let timer = null;
    let done = false;

    const finish = (result) => {
      if (done) return;
      done = true;
      observer?.disconnect();
      clearInterval(fallback);
      clearTimeout(timer);
      pending.delete(cancel);
      resolve(result);
    };
    const cancel = (value) => finish({ value, matched: false, immediate: false });

    const watchRoots = () => {
      if (!observer || typeof roots !== "function") return;
      for (const root of roots(doc) ?? []) {
        if (!root || watched.has(root)) continue;
        watched.add(root);
        observer.observe(root, { ...OBSERVE_OPTIONS });
      }
    };

    const run = () => {
      if (done) return;
      const value = safeCheck(check, doc);
      if (value) finish({ value, matched: true, immediate: false });
      else watchRoots();
    };

    if (typeof Observer === "function") {
      observer = new Observer(run);
      observer.observe(doc, { ...OBSERVE_OPTIONS });
      watchRoots();
    }
    fallback = setInterval(run, fallbackMs);
    timer = setTimeout(() => finish(timedOut()), timeoutMs);
    pending.add(cancel);
  });
}
