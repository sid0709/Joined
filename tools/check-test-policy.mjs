import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaces = [
  "openseat-frontend",
  "openseat-theme",
  "opened-frontend",
  "packages/design-system",
  // Repo-level tests (e.g. the dependency rule) live outside any workspace.
  "tests",
];
const ignoredDirectories = new Set([".next", ".turbo", "coverage", "dist", "node_modules"]);
const testFilePattern = /\.(?:test|spec)\.[cm]?[jt]sx?$/;
const forbiddenTestPattern =
  /\b(?:describe|it|test)\s*\.\s*(?:skip|only|todo)(?:If)?\s*\(|\b(?:fdescribe|fit|xdescribe|xit|xtest)\s*\(/;
const violations = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && !ignoredDirectories.has(entry.name)) {
      files.push(...(await walk(path.join(directory, entry.name))));
    } else if (entry.isFile() && testFilePattern.test(entry.name)) {
      files.push(path.join(directory, entry.name));
    }
  }

  return files;
}

for (const workspace of workspaces) {
  for (const filename of await walk(path.join(repoRoot, workspace))) {
    const lines = (await readFile(filename, "utf8")).split(/\r?\n/);

    lines.forEach((line, index) => {
      if (forbiddenTestPattern.test(line)) {
        const relativeFile = path.relative(repoRoot, filename).split(path.sep).join("/");
        violations.push(
          `${relativeFile}:${index + 1}: skipped, todo, or focused tests are not allowed`,
        );
      }
    });
  }
}

if (violations.length > 0) {
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log("No skipped, todo, or focused tests found.");
}
