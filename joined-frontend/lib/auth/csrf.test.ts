import { describe, expect, test } from "bun:test";
import {
  CSRF_FORBIDDEN_STATUS,
  JSON_MEDIA_TYPE,
  SAME_ORIGIN_FETCH_SITE,
  emailAuthCsrfReject,
  isJsonContentType,
  isSameOriginRequest,
} from "./csrf";
import { EMAIL_MESSAGES } from "./email";

const APP = "http://app.test/api/auth/signin";

function post(headers: HeadersInit, body = "{}"): Request {
  return new Request(APP, { method: "POST", headers, body });
}

describe("isJsonContentType", () => {
  test("accepts application/json with an optional charset", () => {
    expect(isJsonContentType(null)).toBe(false);
    expect(isJsonContentType("")).toBe(false);
    expect(isJsonContentType("text/plain")).toBe(false);
    expect(isJsonContentType("application/x-www-form-urlencoded")).toBe(false);
    expect(isJsonContentType(JSON_MEDIA_TYPE)).toBe(true);
    expect(isJsonContentType("Application/JSON; charset=utf-8")).toBe(true);
  });
});

describe("isSameOriginRequest", () => {
  test("accepts same-origin Sec-Fetch-Site or a matching Origin", () => {
    expect(isSameOriginRequest(post({ "Sec-Fetch-Site": SAME_ORIGIN_FETCH_SITE }))).toBe(true);
    expect(isSameOriginRequest(post({ Origin: "http://app.test" }))).toBe(true);
    expect(
      isSameOriginRequest(
        post({ Origin: "http://app.test", "Sec-Fetch-Site": SAME_ORIGIN_FETCH_SITE }),
      ),
    ).toBe(true);
  });

  test("rejects cross-site fetches, other origins, and missing proof", () => {
    expect(isSameOriginRequest(post({}))).toBe(false);
    expect(isSameOriginRequest(post({ Origin: "https://evil.test" }))).toBe(false);
    expect(isSameOriginRequest(post({ Origin: "null" }))).toBe(false);
    expect(isSameOriginRequest(post({ "Sec-Fetch-Site": "cross-site" }))).toBe(false);
    expect(isSameOriginRequest(post({ "Sec-Fetch-Site": "same-site" }))).toBe(false);
    expect(
      isSameOriginRequest(post({ Origin: "http://app.test", "Sec-Fetch-Site": "cross-site" })),
    ).toBe(false);
  });
});

describe("emailAuthCsrfReject", () => {
  test("rejects a text/plain body even from the same origin", () => {
    const response = emailAuthCsrfReject(
      post({
        "Content-Type": "text/plain",
        Origin: "http://app.test",
        "Sec-Fetch-Site": SAME_ORIGIN_FETCH_SITE,
      }),
    );
    expect(response?.status).toBe(CSRF_FORBIDDEN_STATUS);
  });

  test("rejects JSON from another origin or a cross-site fetch", () => {
    expect(
      emailAuthCsrfReject(post({ "Content-Type": JSON_MEDIA_TYPE, Origin: "https://evil.test" }))
        ?.status,
    ).toBe(CSRF_FORBIDDEN_STATUS);
    expect(
      emailAuthCsrfReject(post({ "Content-Type": JSON_MEDIA_TYPE, "Sec-Fetch-Site": "cross-site" }))
        ?.status,
    ).toBe(CSRF_FORBIDDEN_STATUS);
  });

  test("allows same-origin JSON", async () => {
    expect(
      emailAuthCsrfReject(
        post({
          "Content-Type": "application/json; charset=utf-8",
          Origin: "http://app.test",
          "Sec-Fetch-Site": SAME_ORIGIN_FETCH_SITE,
        }),
      ),
    ).toBeNull();
    const rejected = emailAuthCsrfReject(post({ "Content-Type": "text/plain" }));
    expect(rejected && (await rejected.json())).toEqual({ error: EMAIL_MESSAGES.forbidden });
  });
});
