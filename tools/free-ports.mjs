import { execFileSync, spawnSync } from "node:child_process";

function sleep(ms) {
  spawnSync("sleep", [String(ms / 1000)]);
}

export function listeningPids(port) {
  try {
    const output = execFileSync("lsof", [`-tiTCP:${port}`, "-sTCP:LISTEN"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output
      .split("\n")
      .map((line) => line.trim())
      .filter((pid) => pid && pid !== String(process.pid));
  } catch {
    return [];
  }
}

export function isPortListening(port) {
  return listeningPids(port).length > 0;
}

/**
 * Stop processes listening on the given TCP ports (SIGTERM, then SIGKILL).
 * @param {number[]} ports
 * @param {{ label?: string }} [options]
 */
export function freePorts(ports, options = {}) {
  const uniquePorts = [...new Set(ports.map(String))];
  const pids = [...new Set(uniquePorts.flatMap((port) => listeningPids(port)))];
  if (pids.length === 0) {
    return;
  }

  const heading = options.label
    ? `Stopping whatever is already listening (${options.label}):`
    : "Stopping whatever is already listening on the dev ports:";
  console.log(heading);
  for (const pid of pids) {
    const held = uniquePorts.filter((port) => listeningPids(port).includes(pid));
    console.log(`  pid ${pid}${held.length ? ` on ${held.join(", ")}` : ""}`);
    try {
      process.kill(Number(pid), "SIGTERM");
    } catch {
      // Already gone.
    }
  }

  const deadline = Date.now() + 2000;
  while (Date.now() < deadline && uniquePorts.some((port) => listeningPids(port).length > 0)) {
    sleep(100);
  }
  for (const port of uniquePorts) {
    for (const pid of listeningPids(port)) {
      try {
        process.kill(Number(pid), "SIGKILL");
      } catch {
        // Already gone.
      }
    }
  }
  sleep(200);
  console.log("");
}
