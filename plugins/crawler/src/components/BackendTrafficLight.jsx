import { Box, Stack, Tooltip, Typography } from "@mui/material";
import { API_URL } from "../config/env";
import useBackendHealth from "../api/useBackendHealth";

const LIGHT = {
  off: "rgba(255,255,255,0.1)",
  red: "#f87171",
  yellow: "#fbbf24",
  green: "#34d399",
};

function TrafficDot({ color, active, label }) {
  return (
    <Box
      aria-label={label}
      sx={{
        width: 10,
        height: 10,
        borderRadius: "50%",
        bgcolor: active ? color : LIGHT.off,
        boxShadow: active ? `0 0 10px ${color}` : "none",
        transition: "background-color 0.2s ease, box-shadow 0.2s ease",
      }}
    />
  );
}

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

  const redOn = meta.active === "red";
  const yellowOn = meta.active === "yellow";
  const greenOn = meta.active === "green";

  return (
    <Tooltip title={`${meta.label} — ${meta.detail}`} arrow>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ userSelect: "none", minWidth: 0 }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.6,
            px: 1,
            py: 0.75,
            borderRadius: 2.5,
            bgcolor: "secondary.main",
            border: "1px solid",
            borderColor: "divider",
            flexShrink: 0,
          }}
        >
          <TrafficDot color={LIGHT.red} active={redOn} label="offline" />
          <TrafficDot color={LIGHT.yellow} active={yellowOn} label="connecting" />
          <TrafficDot color={LIGHT.green} active={greenOn} label="online" />
        </Box>
        <Stack spacing={0.15} sx={{ minWidth: 0, textAlign: "left" }}>
          <Typography
            variant="caption"
            sx={{
              lineHeight: 1.2,
              fontWeight: 700,
              color: greenOn
                ? "success.main"
                : yellowOn
                  ? "warning.main"
                  : redOn
                    ? "error.main"
                    : "text.secondary",
            }}
          >
            {meta.label}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              lineHeight: 1.2,
              fontFamily: "var(--font-mono)",
              fontSize: "0.65rem",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 140,
            }}
            title={targetApiUrl || undefined}
          >
            {targetApiUrl || "not set"}
          </Typography>
        </Stack>
      </Stack>
    </Tooltip>
  );
}
