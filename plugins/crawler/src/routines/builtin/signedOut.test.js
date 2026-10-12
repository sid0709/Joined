import { describe, expect, test } from "bun:test";

import { SIGN_UP_MODAL_TEXT } from "./constants.js";
import { isSignedOutSession } from "./signedOut.js";
import "./testing/domParser.js";
import { loadFixture } from "./testing/loadFixture.js";

describe("isSignedOutSession", () => {
  test("treats explicit isLoggedIn false and the save-wall modal as signed out", () => {
    expect(isSignedOutSession({ isLoggedIn: false })).toBe(true);
    expect(isSignedOutSession({ isLoggedIn: true })).toBe(false);
    expect(isSignedOutSession({ html: `<dialog>${SIGN_UP_MODAL_TEXT}</dialog>` })).toBe(true);
    expect(isSignedOutSession({ html: loadFixture("list-last.html") })).toBe(false);
    expect(
      isSignedOutSession({
        html: '<script>Builtin.jobPostInit({"job":{"id":1},"isLoggedIn":false});</script>',
      }),
    ).toBe(true);
  });

  test("treats a header login link as signed out, not Log In to apply", () => {
    expect(
      isSignedOutSession({
        html: '<header><a href="/auth/login">Sign In</a></header>',
      }),
    ).toBe(true);
    expect(
      isSignedOutSession({
        html: '<nav><a href="https://www.builtin.com/auth/login">Log In</a></nav>',
      }),
    ).toBe(true);
    expect(isSignedOutSession({ html: loadFixture("detail-signed-in.html") })).toBe(false);
    expect(isSignedOutSession({ html: loadFixture("detail-easyapply.html") })).toBe(false);
  });

  test("does not stop when init is missing", () => {
    expect(isSignedOutSession({ html: "<html><body>jobs</body></html>" })).toBe(false);
    expect(isSignedOutSession({ isLoggedIn: undefined })).toBe(false);
  });
});
