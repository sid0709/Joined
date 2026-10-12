import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures");

export const loadFixture = (name) => {
  const file = name.endsWith(".txt") ? name : `${name}.txt`;
  return readFileSync(join(fixturesDir, file), "utf8");
};
