import { describe, expect, test } from "bun:test";

import manifest from "../manifest.json";
import packageJson from "../package.json";

describe("Joined Scrapper version", () => {
  test("keeps package.json and manifest.json on the same version", () => {
    expect(packageJson.version).toBe(manifest.version);
    expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
