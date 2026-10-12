/** Status page incidents: /v1/admin/status/incidents (backend-core/statuspage). */

export const STATUS_INCIDENTS_PATH = "/v1/admin/status/incidents";

/** The public status page on Joined's site (joined-frontend ROUTES.status). */
export const JOINED_STATUS_PATH = "/status";

export function incidentUpdatesPath(id: string) {
  return `${STATUS_INCIDENTS_PATH}/${encodeURIComponent(id)}/updates`;
}

export const INCIDENT_IMPACTS = [
  { value: "none", label: "Notice: nothing is broken" },
  { value: "minor", label: "Minor: slow or partly broken" },
  { value: "major", label: "Major: a feature is down for some" },
  { value: "critical", label: "Critical: down for everyone" },
] as const;
export type IncidentImpact = (typeof INCIDENT_IMPACTS)[number]["value"];

export const INCIDENT_PHASES = [
  { value: "investigating", label: "Investigating" },
  { value: "identified", label: "Identified" },
  { value: "monitoring", label: "Monitoring" },
  { value: "resolved", label: "Resolved" },
] as const;
export type IncidentPhase = (typeof INCIDENT_PHASES)[number]["value"];

export const IMPACT_BADGE: Record<IncidentImpact, "neutral" | "warning" | "error"> = {
  none: "neutral",
  minor: "warning",
  major: "warning",
  critical: "error",
};

export type IncidentUpdate = { status: IncidentPhase; message: string; at: string; by?: string };

export type StatusIncident = {
  id: string;
  title: string;
  impact: IncidentImpact;
  components: string[];
  status: IncidentPhase;
  updates: IncidentUpdate[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
};

export type StatusComponentOption = { id: string; name: string };

export type IncidentList = {
  incidents: StatusIncident[];
  components: StatusComponentOption[];
};

export type NewIncidentBody = {
  title: string;
  impact: IncidentImpact;
  components: string[];
  status: IncidentPhase;
  message: string;
};

export type NewUpdateBody = {
  status: IncidentPhase;
  message: string;
  impact?: IncidentImpact;
};

export function phaseLabel(phase: IncidentPhase) {
  return INCIDENT_PHASES.find((item) => item.value === phase)?.label ?? phase;
}

export function impactLabel(impact: IncidentImpact) {
  return INCIDENT_IMPACTS.find((item) => item.value === impact)?.label.split(":")[0] ?? impact;
}

/** Unresolved first, then newest. */
export function sortIncidents(incidents: StatusIncident[]) {
  return [...incidents].sort((a, b) => {
    const open = Number(b.status !== "resolved") - Number(a.status !== "resolved");
    return open || b.createdAt.localeCompare(a.createdAt);
  });
}

/** The update body: impact is sent only when staff changed it. */
export function updateBody(
  incident: StatusIncident,
  status: IncidentPhase,
  message: string,
  impact: IncidentImpact,
): NewUpdateBody {
  const body: NewUpdateBody = { status, message: message.trim() };
  if (impact !== incident.impact) body.impact = impact;
  return body;
}
