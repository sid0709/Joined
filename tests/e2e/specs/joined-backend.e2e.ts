import { test, expect } from "@playwright/test";

import { JOINED_API_ORIGIN } from "../helpers/origins";

test.describe("joined-backend API smoke", () => {
  test("GET /health responds 200", async ({ request }) => {
    const response = await request.get(`${JOINED_API_ORIGIN}/health`);
    expect(response.status()).toBe(200);
  });

  test("GET /v1/search/jobs responds 200", async ({ request }) => {
    const response = await request.get(`${JOINED_API_ORIGIN}/v1/search/jobs`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as { jobs?: unknown };
    expect(body).toHaveProperty("jobs");
  });
});
