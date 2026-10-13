import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REAL_DOM_DIR = join(dirname(fileURLToPath(import.meta.url)), "real-dom");

export const REAL_DOM_FILES = Object.freeze([
  "card-unapplied-hover.html",
  "card-applied-hover.html",
  "card-unapplied-rest.html",
  "card-applied-rest.html",
  "elementsFromPoint.txt",
  "diagnostics.txt",
  "diagnostics-264-265.txt",
]);

export const UNAPPLIED_JOB = Object.freeze({
  id: "647det3s8lfu8ipj",
  path: "/job/student-election-worker-travis-county-travis-county-texas-647det3s8lfu8ipj",
  url: "https://hiringcafe.com/job/student-election-worker-travis-county-travis-county-texas-647det3s8lfu8ipj",
  cardHref:
    "https://hiringcafe.com/job/student-election-worker-travis-county-travis-county-texas-647det3s8lfu8ipj",
});

export const APPLIED_JOB = Object.freeze({
  id: "6wfmqg0lc17jeb8e",
  path: "/job/community-health-worker-whole-systems-learning-long-beach-california-6wfmqg0lc17jeb8e",
  url: "https://hiringcafe.com/job/community-health-worker-whole-systems-learning-long-beach-california-6wfmqg0lc17jeb8e",
  cardHref:
    "https://hiringcafe.com/job/community-health-worker-whole-systems-learning-long-beach-california-6wfmqg0lc17jeb8e",
});

/** Resting (unhovered) cards: Show job 2 of Hennepin is not applied; Show job 1 of Cognizant is. */
export const UNAPPLIED_REST_JOB = Object.freeze({
  id: "03bavaf39orwqbpi",
  cardHref:
    "https://hiringcafe.com/job/paramedic-emergency-medical-services-hennepin-healthcare-minneapolis-03bavaf39orwqbpi",
});

export const APPLIED_REST_JOB = Object.freeze({
  id: "vgidu65etwiwcx7w",
  cardHref: "https://hiringcafe.com/job/architect-cognizant-united-states-vgidu65etwiwcx7w",
});

/** Live list card and panel from run 266. */
export const LIVE_CARD_RECT = Object.freeze({
  left: 112,
  top: 316.125,
  width: 319.75,
  height: 416.5,
  right: 431.75,
  bottom: 732.625,
});

export const LIVE_VIEWPORT = Object.freeze({ width: 1534, height: 1049 });

/** Mark Applied button rect from the live elementsFromPoint capture. */
export const LIVE_MARK_RECT = Object.freeze({
  left: 832.09375,
  top: 985.625,
  width: 90.90625,
  height: 32,
  right: 923,
  bottom: 1017.625,
});

export const LIVE_MARK_CENTER = Object.freeze({ x: 877.546875, y: 1001.625 });

export function readRealDom(name) {
  return readFileSync(join(REAL_DOM_DIR, name), "utf8");
}

export function listWithRealCard(cardHtml) {
  return `<!DOCTYPE html><html><body>
    <div data-testid="job-results"><div class="hc-card-grid">
      ${cardHtml}
    </div></div>
  </body></html>`;
}
