import { describe, expect, test } from "bun:test";

import { SIGN_UP_MODAL_TEXT } from "./constants.js";
import { hasVisibleSignUpModal, isSignedOutSession } from "./signedOut.js";
import "./testing/domParser.js";
import { loadFixture } from "./testing/loadFixture.js";

describe("isSignedOutSession", () => {
  test("treats explicit isLoggedIn false and a visible save-wall modal as signed out", () => {
    expect(isSignedOutSession({ isLoggedIn: false })).toBe(true);
    expect(isSignedOutSession({ isLoggedIn: true })).toBe(false);
    expect(isSignedOutSession({ html: `<dialog>${SIGN_UP_MODAL_TEXT}</dialog>` })).toBe(true);
    expect(isSignedOutSession({ html: loadFixture("list-last.html") })).toBe(false);
    expect(
      isSignedOutSession({
        html: '<script>Builtin.jobPostInit({"job":{"id":1},"isLoggedIn":false});</script>',
      }),
    ).toBe(true);
    expect(
      isSignedOutSession({
        html: '<script>Builtin.jobBoardInit({"isLoggedIn":false});</script>',
      }),
    ).toBe(true);
  });

  test("ignores hidden save-wall copy on a signed-in list page", () => {
    const html = loadFixture("list-signed-in-hidden-modal.html");
    expect(html).toContain(SIGN_UP_MODAL_TEXT);
    expect(html).toContain('"isLoggedIn":true');
    expect(hasVisibleSignUpModal(html)).toBe(false);
    expect(isSignedOutSession({ html })).toBe(false);
    expect(
      isSignedOutSession({
        html: `<html><body>jobs<dialog style="display: none;">${SIGN_UP_MODAL_TEXT}</dialog></body></html>`,
      }),
    ).toBe(false);
    expect(
      isSignedOutSession({
        html: '<header><a href="/auth/login">Sign In</a></header>',
      }),
    ).toBe(false);
    expect(isSignedOutSession({ html: loadFixture("detail-signed-in.html") })).toBe(false);
  });

  test("does not stop when init is missing", () => {
    expect(isSignedOutSession({ html: "<html><body>jobs</body></html>" })).toBe(false);
    expect(isSignedOutSession({ isLoggedIn: undefined })).toBe(false);
  });
});
