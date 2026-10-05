import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "bun:test";

import { DEV_API_HOST, PRODUCTION_API_HOST, hostPermissionPattern } from "../api/hosts";

import {
  MANIFEST_VERSION_MV3,
  checkProductionBuild,
  checkProductionManifest,
} from "./checkManifest";

const productionPermission = hostPermissionPattern(PRODUCTION_API_HOST);

function productionManifest(overrides: Record<string, unknown> = {}) {
  return {
    manifest_version: MANIFEST_VERSION_MV3,
    name: "Scout",
    host_permissions: [productionPermission],
    ...overrides,
  };
}

describe("checkProductionManifest", () => {
  test("passes on a production manifest without local or dev hosts", () => {
    const result = checkProductionManifest(productionManifest());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("fails when host_permissions include localhost", () => {
    const result = checkProductionManifest(
      productionManifest({
        host_permissions: ["http://localhost:8082/*", productionPermission],
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("localhost"))).toBe(true);
  });

  test("fails when host_permissions include 127.0.0.1", () => {
    const result = checkProductionManifest(
      productionManifest({
        host_permissions: ["http://127.0.0.1:8082/*"],
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("127.0.0.1"))).toBe(true);
  });

  test("fails when the production manifest still lists the development API host", () => {
    const result = checkProductionManifest(
      productionManifest({
        host_permissions: [hostPermissionPattern(DEV_API_HOST)],
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes(DEV_API_HOST))).toBe(true);
  });

  test("fails when the payload is not a Manifest V3 object", () => {
    expect(checkProductionManifest(null).ok).toBe(false);
    expect(checkProductionManifest({ manifest_version: 2, host_permissions: [] }).ok).toBe(false);
  });

  test("checkProductionBuild fails on a dist whose manifest still has a dev host", () => {
    const distDir = mkdtempSync(path.join(tmpdir(), "scout-dev-manifest-"));
    try {
      writeFileSync(
        path.join(distDir, "manifest.json"),
        JSON.stringify(
          productionManifest({
            host_permissions: ["http://localhost:8082/*", "http://127.0.0.1:8082/*"],
          }),
        ),
      );
      expect(checkProductionBuild(distDir).ok).toBe(false);
    } finally {
      rmSync(distDir, { recursive: true, force: true });
    }
  });

  test("checkProductionBuild passes on a clean production dist", () => {
    const distDir = mkdtempSync(path.join(tmpdir(), "scout-prod-manifest-"));
    try {
      writeFileSync(path.join(distDir, "manifest.json"), JSON.stringify(productionManifest()));
      const result = checkProductionBuild(distDir);
      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
    } finally {
      rmSync(distDir, { recursive: true, force: true });
    }
  });
});
