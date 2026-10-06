import { test } from "@playwright/test";

import { ACORN_SKIP_REASON } from "../helpers/copy";
import { ACORN_API_ORIGIN, ACORN_FRONTEND_ORIGIN } from "../helpers/origins";

test.describe("acorn website", () => {
  test("landing and sign-in", () => {
    test.skip(
      true,
      `${ACORN_SKIP_REASON} Origins stay ${ACORN_FRONTEND_ORIGIN} and ${ACORN_API_ORIGIN}.`,
    );
  });
});
