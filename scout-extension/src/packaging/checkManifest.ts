import { readFileSync } from "node:fs";
import path from "node:path";

import { containsLocalDevHost, isDevApiHost } from "../api/hosts";

export const MANIFEST_VERSION_MV3 = 3;

export interface PackageCheckResult {
  ok: boolean;
  errors: string[];
}

interface ChromeManifest {
  manifest_version?: number;
  host_permissions?: string[];
  content_scripts?: Array<{ matches?: string[] }>;
  externally_connectable?: { matches?: string[] };
}

export function checkProductionManifest(manifest: unknown): PackageCheckResult {
  const errors: string[] = [];

  if (manifest === null || typeof manifest !== "object" || Array.isArray(manifest)) {
    return { ok: false, errors: ["manifest must be a JSON object"] };
  }

  const record = manifest as ChromeManifest;

  if (record.manifest_version !== MANIFEST_VERSION_MV3) {
    errors.push(`manifest_version must be ${MANIFEST_VERSION_MV3}`);
  }

  collectHostStrings(record).forEach((value) => {
    if (containsLocalDevHost(value)) {
      errors.push(`production manifest must not include a local host: ${value}`);
    } else if (isDevApiHost(value)) {
      errors.push(`production manifest must not include a dev API host: ${value}`);
    }
  });

  return { ok: errors.length === 0, errors };
}

export function checkProductionBuild(distDir: string): PackageCheckResult {
  const manifestPath = path.join(distDir, "manifest.json");
  try {
    const manifest: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
    return checkProductionManifest(manifest);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, errors: [`cannot read ${manifestPath}: ${message}`] };
  }
}

function collectHostStrings(manifest: ChromeManifest): string[] {
  return [
    ...(manifest.host_permissions ?? []),
    ...(manifest.content_scripts ?? []).flatMap((script) => script.matches ?? []),
    ...(manifest.externally_connectable?.matches ?? []),
  ];
}
