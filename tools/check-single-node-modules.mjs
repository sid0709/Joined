// CLI for the dependency rule: `bun run check:deps`. The same rules run in `bun test`
// (tests/dependency-policy.test.js), so CI enforces them either way.
import path from "node:path";
import { fileURLToPath } from "node:url";

import { installViolations, loadRepo, manifestViolations } from "./dependency-policy.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repo = await loadRepo(repoRoot);
const violations = [...manifestViolations(repo), ...(await installViolations(repoRoot, repo))];

if (violations.length > 0) {
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  const count = Object.keys(repo.rootManifest.workspaces?.catalog ?? {}).length;
  console.log(`One node_modules at the root; ${count} libraries, one version each.`);
}
