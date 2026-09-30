import { spawn } from "node:child_process";
import { API_SERVICE } from "./local-services.mjs";
import { freePorts } from "./free-ports.mjs";

freePorts([API_SERVICE.port], { label: API_SERVICE.shortName });

const child = spawn(API_SERVICE.command, API_SERVICE.args, {
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
