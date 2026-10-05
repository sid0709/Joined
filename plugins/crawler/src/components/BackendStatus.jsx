import { HStack, StatusDot, Text } from "sid-ui";

import useBackendHealth from "../api/useBackendHealth";

/** StatusDot variant, short label, and detail for each backend health state. */
function statusMeta(status, apiUrl) {
  switch (status) {
    case "connected":
      return { dot: "success", label: "Online", detail: `REST API healthy at ${apiUrl}` };
    case "connecting":
      return { dot: "warning", label: "Checking", detail: `Checking ${apiUrl}`, isPulsing: true };
    case "disconnected":
      return { dot: "error", label: "Offline", detail: `Cannot reach ${apiUrl}` };
    default:
      return {
        dot: "error",
        label: "Not set",
        detail: "Set VITE_API_URL in plugins/crawler/.env and rebuild",
      };
  }
}

/** The backend's health as a compact dot and word; the API URL is in the tooltip. */
export default function BackendStatus() {
  const { status, apiUrl } = useBackendHealth();
  const meta = statusMeta(status, apiUrl);
  return (
    <HStack gap={1.5} align="center">
      <StatusDot
        variant={meta.dot}
        label={`Backend ${meta.label.toLowerCase()}`}
        tooltip={meta.detail}
        isPulsing={meta.isPulsing}
      />
      <Text type="supporting" color="secondary">
        {meta.label}
      </Text>
    </HStack>
  );
}
