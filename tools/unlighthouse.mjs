import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cli = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../node_modules/@unlighthouse/cli/dist/cli.mjs",
);

const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
