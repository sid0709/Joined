// Repo-level integration test for the dependency rule: every library has one version, declared
// once in the root catalog, installed once in the root node_modules. Runs with `bun run test`
// (and therefore in CI), so a contributor who writes "next": "16.3.6" in a workspace fails CI.
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "bun:test";

import { installViolations, loadRepo, manifestViolations } from "../tools/dependency-policy.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("this repo", () => {
  it("declares every dependency as catalog: or workspace:*", async () => {
    expect(manifestViolations(await loadRepo(repoRoot))).toEqual([]);
  });

  it("has one node_modules, at the root, with one copy of each catalog library", async () => {
    const repo = await loadRepo(repoRoot);
    expect(await installViolations(repoRoot, repo)).toEqual([]);
  });

  it("keeps the catalog on exact versions", async () => {
    const { rootManifest } = await loadRepo(repoRoot);
    const ranged = Object.entries(rootManifest.workspaces.catalog).filter(([, version]) => {
      if (/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) return false;
      // sid-ui is pinned to a git commit until `bun publish` replaces this with 0.1.0.
      if (/^github:sid0709\/sid-ui#[0-9a-f]{40}$/.test(version)) return false;
      return true;
    });
    expect(ranged).toEqual([]);
  });
});

/** A minimal in-memory repo: one catalog entry and one workspace. */
function fixture({ app = {}, overrides, catalog = { next: "16.3.6" } } = {}) {
  return {
    rootManifest: { workspaces: { packages: ["app"], catalog }, overrides },
    workspaces: [{ path: "app", manifest: app }],
  };
}

describe("manifest rules catch the mistakes contributors make", () => {
  it("accepts catalog: and workspace:*", () => {
    const repo = fixture({
      app: { dependencies: { next: "catalog:", "@joined/job-schema": "workspace:*" } },
    });
    expect(manifestViolations(repo)).toEqual([]);
  });

  it("rejects an exact version", () => {
    const repo = fixture({ app: { dependencies: { next: "16.3.6" } } });
    expect(manifestViolations(repo)).toEqual([
      'app/package.json: dependencies.next is "16.3.6" — use "catalog:"',
    ]);
  });

  it("rejects a range in devDependencies", () => {
    const repo = fixture({ app: { devDependencies: { next: "^16" } } });
    expect(manifestViolations(repo)).toEqual([
      'app/package.json: devDependencies.next is "^16" — use "catalog:"',
    ]);
  });

  it("rejects catalog: for a library the catalog doesn't list", () => {
    const repo = fixture({ app: { dependencies: { zod: "catalog:" } } });
    expect(manifestViolations(repo)).toEqual([
      'app/package.json: dependencies.zod uses "catalog:" but the root catalog has no zod',
    ]);
  });

  it("checks the root manifest too", () => {
    const repo = fixture();
    repo.rootManifest.devDependencies = { prettier: "3.9.9" };
    expect(manifestViolations(repo)).toEqual([
      'package.json: devDependencies.prettier is "3.9.9" — use "catalog:"',
    ]);
  });

  it("allows ranges in peerDependencies, which install nothing", () => {
    const repo = fixture({ app: { peerDependencies: { react: ">=19" } } });
    expect(manifestViolations(repo)).toEqual([]);
  });

  it("rejects an override that drifts from the catalog", () => {
    const repo = fixture({ overrides: { next: "16.3.5" } });
    expect(manifestViolations(repo)).toEqual([
      'package.json: overrides.next is "16.3.5", catalog says "16.3.6"',
    ]);
  });
});

describe("install rules catch a second copy", () => {
  async function tempRepo(files) {
    const root = await mkdtemp(path.join(tmpdir(), "dependency-policy-"));
    for (const [file, version] of Object.entries(files)) {
      await mkdir(path.join(root, file), { recursive: true });
      await writeFile(path.join(root, file, "package.json"), JSON.stringify({ version }));
    }
    return root;
  }

  it("passes a single root copy at the catalog version", async () => {
    const root = await tempRepo({ "node_modules/next": "16.3.6" });
    try {
      expect(await installViolations(root, fixture())).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("flags a workspace node_modules, a wrong version, and a nested copy", async () => {
    const root = await tempRepo({
      "app/node_modules/left-pad": "1.0.0",
      "node_modules/next": "16.3.5",
      "node_modules/@scope/tool/node_modules/next": "15.0.0",
    });
    try {
      expect(await installViolations(root, fixture())).toEqual([
        "app/node_modules exists — only the root may have one",
        "node_modules/next is 16.3.5, catalog says 16.3.6",
        "node_modules/@scope/tool/node_modules/next is a second copy of next",
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("flags a missing install", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "dependency-policy-"));
    try {
      expect(await installViolations(root, fixture())).toEqual([
        "node_modules is missing — run bun install",
      ]);
      await mkdir(path.join(root, "node_modules"));
      expect(await installViolations(root, fixture())).toEqual([
        "node_modules/next is missing — run bun install",
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
