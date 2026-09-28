import { spawn } from "node:child_process";

const reset = "\x1b[0m";

const services = [
  {
    name: "app",
    color: "\x1b[36m",
    url: "http://localhost:3000",
    command: "bun",
    args: ["--filter", "connected-frontend", "dev"],
  },
  {
    name: "theme",
    color: "\x1b[35m",
    url: "http://localhost:3001",
    command: "bun",
    args: ["--filter", "openseat-theme", "dev"],
  },
  {
    name: "opened",
    color: "\x1b[32m",
    url: "http://localhost:3002",
    command: "bun",
    args: ["--filter", "opened-frontend", "dev"],
  },
  {
    name: "admin",
    color: "\x1b[33m",
    url: "http://localhost:3010",
    command: "bun",
    args: ["--cwd", "opened-admin", "dev"],
  },
  {
    name: "api",
    color: "\x1b[34m",
    url: "http://127.0.0.1:8080",
    command: "go",
    args: ["run", "-C", "opened-backend", "./cmd/server"],
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
