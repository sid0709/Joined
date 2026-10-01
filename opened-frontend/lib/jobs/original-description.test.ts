import { describe, expect, it } from "bun:test";

import { originalDescription } from "./original-description";

describe("originalDescription", () => {
  it("shows a short posting whole, with nothing to expand", () => {
    const result = originalDescription("Build things.\n\nShip them.", false, 100);
    expect(result).toEqual({ paragraphs: ["Build things.", "Ship them."], isTruncatable: false });
  });

  it("cuts a long posting at a word and adds an ellipsis until it is opened", () => {
    const text = "alpha beta gamma delta epsilon zeta";
    const closed = originalDescription(text, false, 14);
    expect(closed.isTruncatable).toBe(true);
    expect(closed.paragraphs).toEqual(["alpha beta…"]);
    expect(originalDescription(text, true, 14).paragraphs).toEqual([text]);
  });

  it("treats a missing posting as empty", () => {
    expect(originalDescription(undefined, false)).toEqual({ paragraphs: [], isTruncatable: false });
  });
});
