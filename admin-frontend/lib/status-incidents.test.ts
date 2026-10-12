import { describe, expect, it } from "bun:test";
import {
  impactLabel,
  incidentUpdatesPath,
  sortIncidents,
  updateBody,
  type StatusIncident,
} from "./status-incidents";

const incident = (
  id: string,
  status: StatusIncident["status"],
  createdAt: string,
): StatusIncident => ({
  id,
  title: id,
  impact: "minor",
  components: ["api"],
  status,
  updates: [],
  createdAt,
  updatedAt: createdAt,
});

describe("status incidents", () => {
  it("lists unresolved incidents first, then newest", () => {
    const sorted = sortIncidents([
      incident("old-open", "investigating", "2026-10-01T00:00:00Z"),
      incident("new-closed", "resolved", "2026-10-10T00:00:00Z"),
      incident("new-open", "monitoring", "2026-10-09T00:00:00Z"),
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["new-open", "old-open", "new-closed"]);
  });

  it("sends impact only when it changed", () => {
    const current = incident("a", "investigating", "2026-10-01T00:00:00Z");
    expect(updateBody(current, "identified", " Found it. ", "minor")).toEqual({
      status: "identified",
      message: "Found it.",
    });
    expect(updateBody(current, "identified", "Worse.", "critical").impact).toBe("critical");
  });

  it("labels and paths", () => {
    expect(impactLabel("critical")).toBe("Critical");
    expect(incidentUpdatesPath("a/b")).toBe("/v1/admin/status/incidents/a%2Fb/updates");
  });
});
