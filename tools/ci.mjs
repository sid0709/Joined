// Runs the same checks as .github/workflows/ci.yml. The workflow calls `bun run ci <job>`, so
// this file is the single definition of what every CI job runs.
//
//   bun run ci              every job, then a pass/fail summary
//   bun run ci lint test    only the named jobs
import { spawnSync } from "node:child_process";

import { repoRoot } from "./workspaces.mjs";

const baseRef = process.env.CI_BASE_REF ?? "origin/main";

const jobs = {
  lint: [
    ["bun", "run", "lint:workspaces"],
    ["bun", "run", "lint:repo"],
    ["bun", "run", "check:boundaries"],
  ],
  format: [["bun", "run", "format:check"]],
  typecheck: [["bun", "run", "typecheck"]],
  dependencies: [["bun", "run", "check:deps"]],
  test: [["bun", "run", "test"]],
  build: [["bun", "run", "build"]],
  // CI validates the pull request's commits and title itself; locally we check what this branch
  // adds on top of the base branch.
  commits: [() => ["bunx", "commitlint", "--from", mergeBase(), "--to", "HEAD"]],
};

const bold = (text) => `\x1b[1m${text}\x1b[0m`;
const green = (text) => `\x1b[32m${text}\x1b[0m`;
const red = (text) => `\x1b[31m${text}\x1b[0m`;

function mergeBase() {
  const result = spawnSync("git", ["merge-base", baseRef, "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`cannot find merge base with ${baseRef}; run \`git fetch\` or set CI_BASE_REF`);
  }
  return result.stdout.trim();
}

function runJob(name) {
  for (const step of jobs[name]) {
    let command;
    try {
      command = typeof step === "function" ? step() : step;
    } catch (error) {
      console.error(red(error.message));
      return false;
    }
    console.log(bold(`\n[${name}] $ ${command.join(" ")}`));
    const result = spawnSync(command[0], command.slice(1), { cwd: repoRoot, stdio: "inherit" });
    if (result.status !== 0) {
      return false;
    }
  }
  return true;
}

const requested = process.argv.slice(2);
const unknown = requested.filter((name) => !(name in jobs));
if (unknown.length > 0) {
  console.error(`Unknown job(s): ${unknown.join(", ")}. Jobs: ${Object.keys(jobs).join(", ")}`);
  process.exit(1);
}

const selected = requested.length > 0 ? requested : Object.keys(jobs);
const results = selected.map((name) => ({ name, passed: runJob(name) }));

if (selected.length > 1) {
  console.log(bold("\nCI summary"));
  for (const { name, passed } of results) {
    console.log(`  ${passed ? green("pass") : red("FAIL")}  ${name}`);
  }
}

process.exitCode = results.every((result) => result.passed) ? 0 : 1;
