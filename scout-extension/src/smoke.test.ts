import { expect, test } from "bun:test";

test("manifest is a valid mv3 extension", async () => {
  const manifest = await Bun.file(new URL("../manifest.json", import.meta.url)).json();
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.name).toBe("Scout");
});
