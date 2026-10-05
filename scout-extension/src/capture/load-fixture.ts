import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseHtmlDocument } from "./html-document";
import type { PageRoot } from "./page";

export const FIXTURES_DIR = fileURLToPath(new URL("../../fixtures/", import.meta.url));

export function readFixtureHtml(filename: string): string {
  return readFileSync(path.join(FIXTURES_DIR, filename), "utf8");
}

export function loadFixtureDocument(filename: string): PageRoot {
  return parseHtmlDocument(readFixtureHtml(filename));
}
