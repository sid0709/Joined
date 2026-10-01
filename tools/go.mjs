// Runs a go command over every module in go.work, so `bun run test:go` covers all
// backend services and backend-core: `bun tools/go.mjs test` → `go test <module>/...`.
import { spawnSync } from "node:child_process";

import { repoRoot } from "./workspaces.mjs";

const [command, ...flags] = process.argv.slice(2);
if (!command) {
  console.error("Usage: bun tools/go.mjs <go command> [flags]");
  process.exit(1);
}

const modules = spawnSync("go", ["list", "-m", "-f", "{{.Dir}}"], {
  cwd: repoRoot,
  encoding: "utf8",
});
if (modules.status !== 0) {
  console.error(modules.stderr || "go list failed; is Go installed?");
  process.exit(1);
}

const patterns = modules.stdout
  .split("\n")
  .filter(Boolean)
  .map((directory) => `${directory}/...`);
const result = spawnSync("go", [command, ...flags, ...patterns], {
  cwd: repoRoot,
  stdio: "inherit",
});
process.exitCode = result.status ?? 1;
