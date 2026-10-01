import { AUDIT_FRONTEND_IDS, LOCAL_SERVICES, serviceSite } from "./local-services.mjs";

export const AUDIT_FRONTENDS = AUDIT_FRONTEND_IDS.map((id) => {
  const service = LOCAL_SERVICES.find((entry) => entry.id === id);
  if (!service) {
    throw new Error(`Missing local service for audit target ${id}`);
  }
  const labels = {
    "connected-frontend": "Connected",
    "joined-frontend": "Joined",
    "scoutwell-frontend": "Scoutwell",
    "admin-frontend": "Joined admin",
  };
  return {
    id: service.id,
    label: labels[service.id] ?? service.id,
    site: serviceSite(service),
    port: service.port,
  };
});

export function auditTarget(id) {
  const target = AUDIT_FRONTENDS.find((entry) => entry.id === id);
  if (!target) {
    const known = AUDIT_FRONTENDS.map((entry) => entry.id).join(", ");
    throw new Error(`Unknown audit target "${id}". Expected one of: ${known}`);
  }
  return target;
}
