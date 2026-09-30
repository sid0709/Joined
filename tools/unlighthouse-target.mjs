import { auditTarget } from "./audit-frontends.mjs";
import { outputPathForTarget, runUnlighthouse } from "./unlighthouse-run.mjs";

const id = process.argv[2];
const extraArgs = process.argv.slice(3);

if (!id) {
  console.error("Usage: bun tools/unlighthouse-target.mjs <workspace-name> [unlighthouse flags]");
  process.exit(1);
}

let target;
try {
  target = auditTarget(id);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const hasSiteFlag = extraArgs.some((arg) => arg === "--site" || arg.startsWith("--site="));
const args = [
  ...(hasSiteFlag ? [] : ["--site", target.site]),
  "--output-path",
  outputPathForTarget(target.id),
  ...extraArgs,
];

const code = await runUnlighthouse(args);
process.exit(code);
