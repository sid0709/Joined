// Runs backend services: `bun tools/run-api.mjs` starts all of them, or name them
// (`joined-api`, `admin-api`, `scout-api`, or their folder names) to start some.
import { spawn } from "node:child_process";

import { freePorts } from "./free-ports.mjs";
import { API_SERVICES, apiService } from "./local-services.mjs";
import { runMany } from "./run-many.mjs";

let services;
try {
  const requested = process.argv.slice(2);
  services = requested.length > 0 ? requested.map(apiService) : API_SERVICES;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

if (services.length > 1) {
  runMany(
    "Starting the backend services",
    services.map((service) => ({ ...service, name: service.shortName })),
  );
} else {
  const [service] = services;
  freePorts([service.port], { label: service.shortName });

  const child = spawn(service.command, service.args, {
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
}
