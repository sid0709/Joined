import { spawn } from "node:child_process";

import { freePorts } from "./free-ports.mjs";
import { API_SERVICE, LOCAL_SERVICES, serviceSite } from "./local-services.mjs";

const reset = "\x1b[0m";

const services = [
  ...LOCAL_SERVICES.map((service) => ({
    name: service.shortName,
    color: service.color,
    url: serviceSite(service),
    command: "bun",
    args: ["--filter", service.workspace, "dev"],
  })),
  {
    name: API_SERVICE.shortName,
    color: API_SERVICE.color,
    url: API_SERVICE.url,
    command: API_SERVICE.command,
    args: API_SERVICE.args,
  },
];

const children = [];
let shuttingDown = false;

function writePrefixed(stream, service, chunk, buffer) {
  buffer.value += chunk.toString();
  const lines = buffer.value.split(/\r?\n/);
  buffer.value = lines.pop() ?? "";
  for (const line of lines) {
    stream.write(`${service.color}[${service.name}]${reset} ${line}\n`);
  }
}

function flush(stream, service, buffer) {
  if (buffer.value.length === 0) {
    return;
  }
  stream.write(`${service.color}[${service.name}]${reset} ${buffer.value}\n`);
  buffer.value = "";
}

function killService(child) {
  if (!child.pid || child.killed) {
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

function shutdown() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of children) {
    killService(child);
  }
  setTimeout(() => {
    for (const child of children) {
      if (!child.pid) {
        continue;
      }
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        // Already gone.
      }
    }
    process.exit(0);
  }, 3000).unref();
}

const ports = [...new Set(services.map((service) => new URL(service.url).port))];
freePorts(ports);

console.log("Starting every OpenSeat dev server:\n");
for (const service of services) {
  console.log(`  ${service.color}${service.name.padEnd(7)}${reset}  ${service.url}`);
}
console.log("\nStop them all with Ctrl+C.\n");

for (const service of services) {
  const stdout = { value: "" };
  const stderr = { value: "" };
  const child = spawn(service.command, service.args, {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  children.push(child);
  child.stdout.on("data", (chunk) => writePrefixed(process.stdout, service, chunk, stdout));
  child.stderr.on("data", (chunk) => writePrefixed(process.stderr, service, chunk, stderr));
  child.on("exit", (code, signal) => {
    flush(process.stdout, service, stdout);
    flush(process.stderr, service, stderr);
    if (shuttingDown) {
      return;
    }
    const detail = signal ? `signal ${signal}` : `code ${code}`;
    process.stderr.write(`${service.color}[${service.name}]${reset} exited (${detail})\n`);
  });
  child.on("error", (error) => {
    process.stderr.write(
      `${service.color}[${service.name}]${reset} failed to start: ${error.message}\n`,
    );
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
