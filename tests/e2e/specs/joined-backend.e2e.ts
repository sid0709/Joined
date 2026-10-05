import { test, expect } from "@playwright/test";

test.describe("joined-backend API smoke", () => {
  test("GET /health responds 200", async ({ request }) => {
    const response = await request.get("http://127.0.0.1:8080/health");
    expect(response.status()).toBe(200);
  });

  test("GET /v1/search/jobs responds 200", async ({ request }) => {
    const response = await request.get("http://127.0.0.1:8080/v1/search/jobs");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as { jobs?: unknown };
    expect(body).toHaveProperty("jobs");
  });
});
