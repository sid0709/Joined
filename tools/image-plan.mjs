// Decides which production images to build for one commit, and which to retag.
//
// Compose pulls every service at sha-<commit>. An unchanged service still needs
// that tag, so the deploy points it at the previous image instead of rebuilding.
// A manual deploy builds every image: the previous image may be newer than the
// commit being rolled out.
import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { repoRoot, workspaces } from "./workspaces.mjs";

const goDockerfile = "docker/go-service.Dockerfile";
const nextDockerfile = "docker/next-app.Dockerfile";
// The Next.js image installs from the workspace root, so a catalog or lockfile
// change rebuilds every frontend. Go images copy only their module.
const frontendRootFiles = ["package.json", "bun.lock", "bunfig.toml"];

export const imageDefinitions = [
  { service: "joined-backend", dockerfile: goDockerfile, arg: "SERVICE", kind: "go" },
  { service: "admin-backend", dockerfile: goDockerfile, arg: "SERVICE", kind: "go" },
  { service: "scoutwell-backend", dockerfile: goDockerfile, arg: "SERVICE", kind: "go" },
  { service: "acorn-backend", dockerfile: goDockerfile, arg: "SERVICE", kind: "go" },
  { service: "joined-frontend", dockerfile: nextDockerfile, arg: "APP", kind: "next" },
  { service: "admin-frontend", dockerfile: nextDockerfile, arg: "APP", kind: "next" },
  { service: "scoutwell-frontend", dockerfile: nextDockerfile, arg: "APP", kind: "next" },
  { service: "connected-frontend", dockerfile: nextDockerfile, arg: "APP", kind: "next" },
  { service: "acorn-frontend", dockerfile: nextDockerfile, arg: "APP", kind: "next" },
];

const directoryByName = new Map(
  workspaces.map((workspace) => [workspace.name, workspace.directory]),
);

function workspaceDependencies(directory, seen = new Set()) {
  if (seen.has(directory)) return [];
  seen.add(directory);
  const manifest = JSON.parse(readFileSync(path.join(repoRoot, directory, "package.json"), "utf8"));
  const declared = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.optionalDependencies,
  };
  const directories = [];
  for (const [name, version] of Object.entries(declared)) {
    if (typeof version !== "string" || !version.startsWith("workspace:")) continue;
    const dependency = directoryByName.get(name);
    if (!dependency) continue;
    directories.push(dependency, ...workspaceDependencies(dependency, seen));
  }
  return directories;
}

export function inputsFor(image) {
  if (image.kind === "go") {
    return {
      files: [goDockerfile],
      directories: [...new Set(["backend-core", image.service])],
    };
  }
  return {
    files: [nextDockerfile, ...frontendRootFiles],
    directories: [...new Set([image.service, ...workspaceDependencies(image.service)])],
  };
}

function affects(file, inputs) {
  if (inputs.files.includes(file)) return true;
  return inputs.directories.some(
    (directory) => file === directory || file.startsWith(`${directory}/`),
  );
}

// planImages returns the services to build and the ones to retag from <service>-latest.
export function planImages(changedFiles, { all = false } = {}) {
  const files = changedFiles.map((file) => file.trim().replaceAll("\\", "/")).filter(Boolean);
  const build = [];
  const retag = [];
  for (const image of imageDefinitions) {
    const changed = all || files.some((file) => affects(file, inputsFor(image)));
    if (changed) {
      build.push({ service: image.service, dockerfile: image.dockerfile, arg: image.arg });
    } else {
      retag.push(image.service);
    }
  }
  return { build, retag };
}

function writeGitHubOutput(plan) {
  const output = process.env.GITHUB_OUTPUT;
  if (!output) {
    console.error("GITHUB_OUTPUT is not set");
    process.exitCode = 1;
    return;
  }
  // An empty matrix is invalid. The image job skips this placeholder.
  const build = plan.build.length
    ? plan.build
    : [{ service: "none", dockerfile: goDockerfile, arg: "SERVICE" }];
  appendFileSync(
    output,
    [
      "build<<EOF",
      JSON.stringify(build),
      "EOF",
      `has_build=${plan.build.length > 0}`,
      `has_retag=${plan.retag.length > 0}`,
      `retag_csv=${plan.retag.join(",")}`,
      "",
    ].join("\n"),
  );
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const all = process.argv.includes("--all");
  const files = all ? [] : (await Bun.stdin.text()).split("\n");
  const plan = planImages(files, { all });
  console.log(
    `build: ${plan.build.map((image) => image.service).join(", ") || "(none)"}\nretag: ${plan.retag.join(", ") || "(none)"}`,
  );
  if (process.argv.includes("--github-output")) writeGitHubOutput(plan);
}
