// One version per library, one node_modules at the root.
//
// Every dependency a workspace declares must come from the root catalog ("catalog:") or be a
// sibling workspace ("workspace:*") — never a version number or range, which is how a second
// copy of a library sneaks in. After install, no workspace may have its own node_modules and
// each catalog library must exist exactly once, at the root, at the catalog's version.
// If a check fails, fix the code to work with the shared version; never add a second one.
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

/** Fields that install something. `peerDependencies` describe compatibility, so ranges are fine there. */
export const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "optionalDependencies"];

const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const exists = (target) =>
  access(target).then(
    () => true,
    () => false,
  );

async function workspaceDirs(repoRoot, patterns) {
  const dirs = [];
  for (const pattern of patterns) {
    if (pattern.endsWith("/*")) {
      const parent = path.join(repoRoot, pattern.slice(0, -2));
      for (const entry of await readdir(parent, { withFileTypes: true })) {
        if (entry.isDirectory()) dirs.push(path.join(parent, entry.name));
      }
    } else {
      dirs.push(path.join(repoRoot, pattern));
    }
  }
  return dirs;
}

/** The root manifest plus every workspace manifest, with paths relative to the repo root. */
export async function loadRepo(repoRoot) {
  const rootManifest = await readJson(path.join(repoRoot, "package.json"));
  const workspaces = [];
  for (const dir of await workspaceDirs(repoRoot, rootManifest.workspaces?.packages ?? [])) {
    const file = path.join(dir, "package.json");
    if (await exists(file)) {
      workspaces.push({ path: path.relative(repoRoot, dir), manifest: await readJson(file) });
    }
  }
  return { rootManifest, workspaces };
}

/** Rules that only need the manifests: catalog-only specs, known catalog entries, overrides in sync. */
export function manifestViolations({ rootManifest, workspaces }) {
  const catalog = rootManifest.workspaces?.catalog ?? {};
  const violations = [];
  const manifests = [{ path: "", manifest: rootManifest }, ...workspaces];

  for (const { path: dir, manifest } of manifests) {
    const where = dir ? `${dir}/package.json` : "package.json";
    for (const field of DEPENDENCY_FIELDS) {
      for (const [name, spec] of Object.entries(manifest[field] ?? {})) {
        if (spec.startsWith("workspace:")) continue;
        if (spec !== "catalog:") {
          violations.push(`${where}: ${field}.${name} is "${spec}" — use "catalog:"`);
        } else if (!(name in catalog)) {
          violations.push(
            `${where}: ${field}.${name} uses "catalog:" but the root catalog has no ${name}`,
          );
        }
      }
    }
  }

  for (const [name, version] of Object.entries(rootManifest.overrides ?? {})) {
    if (catalog[name] !== version) {
      violations.push(
        `package.json: overrides.${name} is "${version}", catalog says "${catalog[name]}"`,
      );
    }
  }

  return violations;
}

/** Rules about what's on disk after `bun install`. */
export async function installViolations(repoRoot, { rootManifest, workspaces }) {
  const catalog = rootManifest.workspaces?.catalog ?? {};
  const violations = [];

  for (const workspace of workspaces) {
    if (await exists(path.join(repoRoot, workspace.path, "node_modules"))) {
      violations.push(`${workspace.path}/node_modules exists — only the root may have one`);
    }
  }

  const rootModules = path.join(repoRoot, "node_modules");
  if (!(await exists(rootModules)))
    return [...violations, "node_modules is missing — run bun install"];

  for (const [name, version] of Object.entries(catalog)) {
    const installed = path.join(rootModules, name, "package.json");
    if (!(await exists(installed))) {
      violations.push(`node_modules/${name} is missing — run bun install`);
      continue;
    }
    const actual = (await readJson(installed)).version;
    const exactVersion = /^\d+\.\d+\.\d+(-[\w.]+)?$/;
    if (exactVersion.test(version) && actual !== version)
      violations.push(`node_modules/${name} is ${actual}, catalog says ${version}`);
  }

  const catalogNames = new Set(Object.keys(catalog));
  async function findNestedCopies(modulesDir) {
    for (const entry of await readdir(modulesDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const packages = entry.name.startsWith("@")
        ? (await readdir(path.join(modulesDir, entry.name), { withFileTypes: true }))
            .filter((scoped) => scoped.isDirectory())
            .map((scoped) => `${entry.name}/${scoped.name}`)
        : [entry.name];
      for (const name of packages) {
        const packageDir = path.join(modulesDir, name);
        if (modulesDir !== rootModules && catalogNames.has(name)) {
          violations.push(`${path.relative(repoRoot, packageDir)} is a second copy of ${name}`);
        }
        const nested = path.join(packageDir, "node_modules");
        if (await exists(nested)) await findNestedCopies(nested);
      }
    }
  }
  await findNestedCopies(rootModules);

  return violations;
}
