import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "bun:test";

/**
 * Apps load openseat.css, whose tokens come from Astryx (astryx.css) and our theme build
 * (theme/theme.css) — not from tokens.css. A var() naming anything else resolves to nothing,
 * which silently drops sizes and whole `transition` declarations.
 */
const styles = path.join(import.meta.dir);
const shipped = [
  readFileSync(require.resolve("@astryxdesign/core/astryx.css"), "utf8"),
  readFileSync(path.join(styles, "../theme/theme.css"), "utf8"),
].join("\n");

/** Gaps that predate this check; fix them, then delete them from this list. */
const KNOWN_GAPS = new Set([
  "--elevation-1",
  "--elevation-2",
  "--elevation-3",
  "--control-height",
  "--surface-hover",
  "--z-overlay",
  "--spacing-2-5",
]);

/** Component-local variables set inline or in the same file, not theme tokens. */
const isLocal = (name: string, css: string) =>
  name.startsWith("--os-") || new RegExp(`${name}\\s*:`).test(css);

describe("component styles", () => {
  const dir = path.join(styles, "components");
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".css"))) {
    it(`${file} only uses tokens the apps load`, () => {
      const css = readFileSync(path.join(dir, file), "utf8");
      const used = new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((match) => match[1]));
      const missing = [...used].filter(
        (name) =>
          !isLocal(name, css) && !KNOWN_GAPS.has(name) && !new RegExp(`${name}\\s*:`).test(shipped),
      );
      expect(missing).toEqual([]);
    });
  }
});
