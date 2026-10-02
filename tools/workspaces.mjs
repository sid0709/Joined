import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const rootManifest = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const workspacePatterns = rootManifest.workspaces.packages;

// Expands the root `workspaces.packages` entries (plain paths and globs) so tools never keep
// their own copy of the workspace list.
export const workspaces = workspacePatterns
  .flatMap((pattern) =>
    pattern.includes("*")
      ? [...new Bun.Glob(`${pattern}/package.json`).scanSync({ cwd: repoRoot })].map((file) =>
          path.dirname(file),
        )
      : [pattern],
  )
  .map((directory) => directory.split(path.sep).join("/"))
  .filter((directory) => existsSync(path.join(repoRoot, directory, "package.json")))
  .map((directory) => ({
    directory,
    name: JSON.parse(readFileSync(path.join(repoRoot, directory, "package.json"), "utf8")).name,
    // Libraries live in a packages/ folder: the root one, or a product's own (bash/packages/*).
    isApp: !/(^|\/)packages\//.test(directory),
  }));
