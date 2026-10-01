import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { repoRoot, workspaces } from "./workspaces.mjs";

// Apps are deploy targets, never dependencies: nothing may import one by package name.
const appPackageNames = workspaces.filter((workspace) => workspace.isApp).map((w) => w.name);
const ignoredDirectories = new Set([".next", ".turbo", "coverage", "dist", "node_modules"]);
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"]);
const specifierPattern = /\b(?:from\s*|import\s*\(|import\s*|require\s*\()\s*["']([^"']+)["']/g;
const violations = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && !ignoredDirectories.has(entry.name)) {
      files.push(...(await walk(path.join(directory, entry.name))));
    } else if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) {
      files.push(path.join(directory, entry.name));
    }
  }

  return files;
}

for (const { directory: workspace } of workspaces) {
  const workspaceRoot = path.join(repoRoot, workspace);

  for (const filename of await walk(workspaceRoot)) {
    const source = await readFile(filename, "utf8");
    const relativeFile = path.relative(repoRoot, filename).split(path.sep).join("/");

    for (const match of source.matchAll(specifierPattern)) {
      const specifier = match[1];
      const location = `${relativeFile}:${source.slice(0, match.index).split("\n").length}`;

      if (specifier.startsWith(".")) {
        const target = path.resolve(path.dirname(filename), specifier);
        const relativeTarget = path.relative(workspaceRoot, target);
        const sharedLintConfig =
          relativeFile.endsWith("/eslint.config.mjs") && specifier === "../eslint.shared.mjs";

        if (
          !sharedLintConfig &&
          (relativeTarget === ".." ||
            relativeTarget.startsWith(`..${path.sep}`) ||
            path.isAbsolute(relativeTarget))
        ) {
          violations.push(`${location}: relative import escapes ${workspace}: ${specifier}`);
        }
      } else if (
        specifier.startsWith("@joined/design-system/src/") ||
        appPackageNames.some((name) => specifier === name || specifier.startsWith(`${name}/`))
      ) {
        violations.push(
          `${location}: import through a workspace's public package entry point: ${specifier}`,
        );
      }
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Workspace imports stay within their package boundaries.");
}
