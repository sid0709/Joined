import { expect, test } from "bun:test";
import { canSubmitUserAction, userDetailPath, userLookupPath } from "./users";

test("lookup prefers email and skips an empty query", () => {
  expect(userLookupPath("  hunter@example.com ", "u1")).toBe(
    "/v1/admin/users?email=hunter%40example.com",
  );
  expect(userLookupPath("", " u1 ")).toBe("/v1/admin/users?id=u1");
  expect(userLookupPath("  ", "")).toBe("");
});

test("detail path encodes the id", () => {
  expect(userDetailPath("user/1")).toBe("/v1/admin/users/user%2F1");
});

test("actions stay off until a reason is present", () => {
  expect(canSubmitUserAction("")).toBe(false);
  expect(canSubmitUserAction("  abuse")).toBe(true);
  expect(canSubmitUserAction("goodwill", 0)).toBe(false);
  expect(canSubmitUserAction("goodwill", 500)).toBe(true);
});
