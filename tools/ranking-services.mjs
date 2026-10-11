// Starts or stops the local ranking services (Qdrant, Redis, the embedder) from
// docker/ranking.compose.yml, picking the embedder build that matches this machine.
//
//   bun run dev:ranking         start them in the background
//   bun run dev:ranking:down    stop them (volumes, and so the index, are kept)
import { spawnSync } from "node:child_process";
import path from "node:path";

import { repoRoot } from "./workspaces.mjs";

const EMBEDDER_IMAGES = {
  arm64: "ghcr.io/huggingface/text-embeddings-inference:cpu-arm64-1.9.4",
  default: "ghcr.io/huggingface/text-embeddings-inference:cpu-1.9.4",
};

const action = process.argv[2] === "down" ? ["down"] : ["up", "-d", "--wait"];
const env = {
  ...process.env,
  EMBEDDER_IMAGE:
    process.env.EMBEDDER_IMAGE ?? EMBEDDER_IMAGES[process.arch] ?? EMBEDDER_IMAGES.default,
};
const result = spawnSync(
  "docker",
  ["compose", "-f", path.join(repoRoot, "docker", "ranking.compose.yml"), ...action],
  { cwd: repoRoot, stdio: "inherit", env },
);
process.exitCode = result.status ?? 1;
