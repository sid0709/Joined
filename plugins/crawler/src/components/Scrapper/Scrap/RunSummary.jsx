import { Box, Stack, Typography } from "@mui/material";
import PropTypes from "prop-types";
import { formatElapsedTime, getSkippedScrapeCount } from "../../../api/scrapeRunStats";

function RunSummary({ elapsedMs, stats, targetTab, queue }) {
  const skipped = getSkippedScrapeCount(stats);
  const totals = [
    { label: "Registered", value: stats.registered, color: "success.main" },
    { label: "Skipped", value: skipped, color: "warning.main" },
    { label: "Failed", value: stats.failed, color: "error.main" },
    { label: "Queued", value: queue.queued, color: "info.light" },
    { label: "Saving", value: queue.saving, color: "primary.light" },
  ];

  return (
    <Stack spacing={1.25} sx={{ width: "100%" }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="caption" sx={{ color: "text.primary", fontWeight: 700 }}>
          Run results
        </Typography>
        <Typography variant="caption" sx={{ color: "primary.light", fontWeight: 700 }}>
          {formatElapsedTime(elapsedMs)}
        </Typography>
      </Stack>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 0.75 }}>
        {totals.map(({ label, value, color }) => (
          <Box
            key={label}
            sx={{
              px: 0.75,
              py: 1,
              textAlign: "center",
              borderRadius: 1.5,
              bgcolor: "rgba(255, 255, 255, 0.025)",
            }}
          >
            <Typography sx={{ color, fontSize: "1rem", fontWeight: 800, lineHeight: 1.1 }}>
              {value}
            </Typography>
            <Typography sx={{ color: "text.secondary", fontSize: "0.625rem", fontWeight: 700 }}>
              {label}
            </Typography>
          </Box>
        ))}
      </Box>
      <Typography variant="caption" sx={{ color: "text.secondary", textAlign: "center" }}>
        Duplicates {stats.duplicate} · Validation {stats.validation} · Blocked {stats.blocked}
      </Typography>
      {targetTab && (
        <Typography
          variant="caption"
          noWrap
          title={targetTab.url}
          sx={{ color: "text.secondary", textAlign: "center" }}
        >
          Target tab #{targetTab.id}: {targetTab.title || new URL(targetTab.url).hostname}
        </Typography>
      )}
    </Stack>
  );
}

RunSummary.propTypes = {
  elapsedMs: PropTypes.number.isRequired,
  stats: PropTypes.shape({
    registered: PropTypes.number.isRequired,
    duplicate: PropTypes.number.isRequired,
    validation: PropTypes.number.isRequired,
    blocked: PropTypes.number.isRequired,
    failed: PropTypes.number.isRequired,
  }).isRequired,
  targetTab: PropTypes.shape({
    id: PropTypes.number.isRequired,
    title: PropTypes.string.isRequired,
    url: PropTypes.string.isRequired,
  }),
  queue: PropTypes.shape({
    queued: PropTypes.number.isRequired,
    saving: PropTypes.number.isRequired,
  }).isRequired,
};

export default RunSummary;
