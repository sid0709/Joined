import { spawn } from "node:child_process";

import { freePorts } from "./free-ports.mjs";

const reset = "\x1b[0m";

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

/**
 * Runs every service at once with prefixed output, and stops them all on Ctrl+C.
 * @param {string} title
 * @param {{ name: string, color: string, url: string, command: string, args: string[] }[]} services
 */
export function runMany(title, services) {
  const ports = [...new Set(services.map((service) => new URL(service.url).port))];
  freePorts(ports);

  const width = Math.max(...services.map((service) => service.name.length));
  console.log(`${title}:\n`);
  for (const service of services) {
    console.log(`  ${service.color}${service.name.padEnd(width)}${reset}  ${service.url}`);
  }
  console.log("\nStop them all with Ctrl+C.\n");

  for (const service of services) {
    start(service);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function start(service) {
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
