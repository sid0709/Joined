import { spawn } from "node:child_process";

import { freePorts } from "./free-ports.mjs";
import { localService } from "./local-services.mjs";

const mode = process.argv[2];
const serviceKey = process.argv[3];

if (mode !== "dev" && mode !== "start") {
  console.error("Usage: bun tools/run-service.mjs <dev|start> <workspace-or-short-name>");
  process.exit(1);
}

if (!serviceKey) {
  console.error("Usage: bun tools/run-service.mjs <dev|start> <workspace-or-short-name>");
  process.exit(1);
}

let service;
try {
  service = localService(serviceKey);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

freePorts([service.port], { label: service.shortName });

const filterArgs = ["--filter", service.workspace, mode];
const childArgs =
  mode === "start" && service.startExtraArgs.length > 0
    ? [...filterArgs, "--", ...service.startExtraArgs]
    : filterArgs;

const child = spawn("bun", childArgs, {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
