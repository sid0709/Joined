import { describe, expect, test } from "bun:test";

import { HEART_INNER, HEART_PREFIX_SAVED, HEART_PREFIX_UNSAVED } from "./constants.js";
import { cssEscape, jobCardSelector, jobSaveSelector } from "./cssEscape.js";
import { heartStateFromRoot, isHeartSaved } from "./heart.js";
import "./testing/domParser.js";

function heartRoot({ saved = false } = {}) {
  const prefix = saved ? HEART_PREFIX_SAVED : HEART_PREFIX_UNSAVED;
  const savedClass = saved ? " saved" : "";
  return new globalThis.DOMParser().parseFromString(
    `<div id="shadow"><div class="heart${savedClass}"><svg data-prefix="${prefix}" data-icon="heart"></svg></div></div>`,
    "text/html",
  );
}

describe("list-card heart", () => {
  test("anchors the card and host on data-id and job-card-{id}", () => {
    expect(jobCardSelector("9256204")).toBe(
      `div[data-id="job-card"]#${cssEscape("job-card-9256204")}`,
    );
    expect(jobSaveSelector("9256204")).toBe(
      `my-item[entity-type="job"][entity-id=${cssEscape("9256204")}]`,
    );
    expect(HEART_INNER).toBe("div.heart");
  });

  test("reads saved from the shadow class, not a stale status attribute", () => {
    expect(isHeartSaved({ classes: "heart", prefix: HEART_PREFIX_UNSAVED })).toBe(false);
    expect(isHeartSaved({ classes: "heart saved", prefix: HEART_PREFIX_SAVED })).toBe(true);
    expect(isHeartSaved({ classes: "heart", prefix: HEART_PREFIX_SAVED })).toBe(true);
    expect(heartStateFromRoot(heartRoot({ saved: false }))).toMatchObject({
      found: true,
      saved: false,
      prefix: HEART_PREFIX_UNSAVED,
    });
    expect(heartStateFromRoot(heartRoot({ saved: true }))).toMatchObject({
      found: true,
      saved: true,
      prefix: HEART_PREFIX_SAVED,
    });
    expect(heartStateFromRoot(null).found).toBe(false);
  });
});
