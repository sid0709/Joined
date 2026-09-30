import { AUDIT_FRONTENDS } from "./audit-frontends.mjs";
import { isPortListening } from "./free-ports.mjs";
import { outputPathForTarget, runUnlighthouse } from "./unlighthouse-run.mjs";

const userArgs = process.argv.slice(2);
const hasSiteFlag = userArgs.some((arg) => arg === "--site" || arg.startsWith("--site="));

if (hasSiteFlag) {
  const code = await runUnlighthouse(userArgs);
  process.exit(code);
}

const missing = AUDIT_FRONTENDS.filter((target) => !isPortListening(target.port));
if (missing.length > 0) {
  console.error("Production servers are not running on every audit port:\n");
  for (const target of missing) {
    console.error(`  - ${target.label}: nothing listening on ${target.port} (${target.site})`);
  }
  console.error(
    "\nBuild and start all frontends first, e.g.\n  bun run build:frontends\n  bun run start:frontends\n",
  );
  process.exit(1);
}

let failed = false;

for (const target of AUDIT_FRONTENDS) {
  console.log(`\n=== Unlighthouse: ${target.label} (${target.site}) ===\n`);
  const code = await runUnlighthouse([
    "--site",
    target.site,
    "--output-path",
    outputPathForTarget(target.id),
    ...userArgs.filter((arg) => arg !== "--disable-dynamic-sampling"),
  ]);
  if (code !== 0) {
    failed = true;
    console.error(`\nAudit failed for ${target.label} (exit ${code}).\n`);
  } else {
    console.log(`Report: ${outputPathForTarget(target.id)}/\n`);
  }
}

if (failed) {
  process.exit(1);
}

console.log("\nAll frontend audits finished. Static reports are under .unlighthouse/<app>/.\n");
