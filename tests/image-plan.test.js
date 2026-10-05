import { describe, expect, it } from "bun:test";

import { planImages } from "../tools/image-plan.mjs";

const services = (plan) => plan.build.map((image) => image.service);

describe("image plan", () => {
  it("rebuilds only the Go service whose directory changed", () => {
    const plan = planImages(["admin-backend/internal/httpapi/server.go"]);
    expect(services(plan)).toEqual(["admin-backend"]);
    expect(plan.retag).toContain("joined-frontend");
    expect(plan.retag).toContain("joined-backend");
    expect(plan.retag).toContain("acorn-backend");
  });

  it("rebuilds every Go image when backend-core changes", () => {
    const plan = planImages(["backend-core/auth/store.go"]);
    expect(services(plan)).toEqual([
      "joined-backend",
      "admin-backend",
      "scoutwell-backend",
      "acorn-backend",
    ]);
    expect(plan.retag).toContain("joined-frontend");
  });

  it("rebuilds frontends that import the design system", () => {
    const plan = planImages(["packages/design-system/src/components/index.ts"]);
    expect(services(plan)).toEqual([
      "joined-frontend",
      "admin-frontend",
      "scoutwell-frontend",
      "connected-frontend",
      "joined-theme",
      "acorn-frontend",
    ]);
    expect(plan.retag).toContain("admin-backend");
  });

  it("follows workspace dependencies past the app's own package.json", () => {
    const plan = planImages(["packages/job-schema/src/index.ts"]);
    expect(services(plan)).toContain("joined-frontend");
    expect(services(plan)).toContain("admin-frontend");
    expect(services(plan)).toContain("scoutwell-frontend");
    expect(plan.retag).toContain("connected-frontend");
    expect(plan.retag).toContain("joined-theme");
  });

  it("rebuilds every frontend when the lockfile changes and leaves Go images tagged", () => {
    const plan = planImages(["bun.lock"]);
    expect(services(plan)).toEqual([
      "joined-frontend",
      "admin-frontend",
      "scoutwell-frontend",
      "connected-frontend",
      "joined-theme",
      "acorn-frontend",
    ]);
    expect(plan.retag).toContain("joined-backend");
  });

  it("retags every image when the commit stays outside the image inputs", () => {
    const plan = planImages([
      "docs/01-glossary.md",
      "deploy/README.md",
      "acorn/extension/src/background.ts",
    ]);
    expect(plan.build).toEqual([]);
    expect(plan.retag).toHaveLength(10);
  });

  it("builds every image for a manual deploy", () => {
    const plan = planImages(["admin-backend/cmd/server/main.go"], { all: true });
    expect(plan.retag).toEqual([]);
    expect(services(plan)).toHaveLength(10);
  });
});
