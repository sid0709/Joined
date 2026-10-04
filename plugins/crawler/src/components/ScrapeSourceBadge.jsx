import { Box, Typography } from "@mui/material";
import PropTypes from "prop-types";
import { SCRAPE_SOURCE } from "../config/env";

const chipSx = {
  display: "inline-flex",
  alignItems: "center",
  maxWidth: "100%",
  px: 1,
  py: 0.3,
  borderRadius: 1.5,
  bgcolor: "rgba(251, 191, 36, 0.18)",
  border: "1px solid",
  borderColor: "rgba(251, 191, 36, 0.7)",
  boxShadow: "0 0 14px rgba(251, 191, 36, 0.28)",
  color: "#fbbf24",
  fontFamily: "var(--font-mono)",
  fontSize: "0.75rem",
  fontWeight: 800,
  letterSpacing: "0.02em",
  lineHeight: 1.3,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export default function ScrapeSourceBadge({ compact = false }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        variant="caption"
        sx={{
          display: "block",
          color: "text.secondary",
          fontWeight: 700,
          letterSpacing: "0.06em",
          lineHeight: 1.2,
          textTransform: "uppercase",
          fontSize: compact ? "0.58rem" : "0.65rem",
          mb: 0.4,
        }}
      >
        Job scrape source
      </Typography>
      <Box component="span" title={SCRAPE_SOURCE} sx={chipSx}>
        {SCRAPE_SOURCE}
      </Box>
    </Box>
  );
}

ScrapeSourceBadge.propTypes = {
  compact: PropTypes.bool,
};
