import { HStack, StatusDot, Text, VStack } from "@joined/design-system";

import useBackendHealth from "../api/useBackendHealth";
import { API_URL } from "../config/env";

/** Traffic-light color for each backend state, as a StatusDot variant. */
const LIGHT_VARIANT = {
  red: "error",
  yellow: "warning",
  green: "success",
};

/** Text tone for each light, as a crawler tone class. */
const LIGHT_TONE = {
  red: "crawler-tone-error",
  yellow: "crawler-tone-warning",
  green: "crawler-tone-success",
};

function statusMeta(status, serverInfo, apiUrl) {
  switch (status) {
    case "connected":
      return serverInfo?.ok
        ? {
            label: "Backend online",
            detail: `REST API healthy at ${apiUrl || "backend"}`,
            active: "green",
          }
        : {
            label: "Connecting…",
            detail: "Waiting for backend handshake",
            active: "yellow",
          };
    case "connecting":
      return {
        label: "Connecting…",
        detail: apiUrl ? `Checking ${apiUrl}` : "Connecting",
        active: "yellow",
      };
    case "disconnected":
      return {
        label: "Backend offline",
        detail: apiUrl ? `Cannot reach ${apiUrl}` : "REST API unavailable",
        active: "red",
      };
    default:
      return {
        label: "Backend not configured",
        detail: "Set server URLs in Extension/.env and reload",
        active: "red",
      };
  }
}

export default function BackendTrafficLight() {
  const { status, serverInfo, apiUrl } = useBackendHealth();
  const meta = statusMeta(status, serverInfo, apiUrl);
  const targetApiUrl = API_URL;

  return (
    <HStack gap={2} align="center">
      <StatusDot
        variant={LIGHT_VARIANT[meta.active]}
        label={meta.label}
        tooltip={`${meta.label} — ${meta.detail}`}
        isPulsing={meta.active === "yellow"}
      />
      <VStack gap={0.5}>
        <Text type="supporting" weight="semibold" className={LIGHT_TONE[meta.active]}>
          {meta.label}
        </Text>
        <Text type="supporting" color="secondary" className="crawler-api-url">
          <span title={targetApiUrl || undefined}>{targetApiUrl || "not set"}</span>
        </Text>
      </VStack>
    </HStack>
  );
}
