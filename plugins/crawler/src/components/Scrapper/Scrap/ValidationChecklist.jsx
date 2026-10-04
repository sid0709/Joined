import { Box, Stack, Typography } from "@mui/material";
import { CheckCircleRounded, ErrorRounded, RadioButtonUncheckedRounded } from "@mui/icons-material";
import PropTypes from "prop-types";

function ValidationChecklist({ checks }) {
  const validCount = checks.filter(({ status }) => status === "valid").length;
  const invalidCount = checks.filter(({ status }) => status === "invalid").length;

  return (
    <Stack spacing={1.25} sx={{ width: "100%" }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="caption" sx={{ color: "text.primary", fontWeight: 700 }}>
          Field validation
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: invalidCount ? "error.main" : "text.secondary", fontWeight: 600 }}
        >
          {invalidCount ? `${invalidCount} missing` : `${validCount}/${checks.length} valid`}
        </Typography>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 0.75,
        }}
      >
        {checks.map((check, index) => {
          const isValid = check.status === "valid";
          const isInvalid = check.status === "invalid";
          const Icon = isValid
            ? CheckCircleRounded
            : isInvalid
              ? ErrorRounded
              : RadioButtonUncheckedRounded;

          return (
            <Stack
              key={check.id}
              direction="row"
              alignItems="center"
              spacing={0.75}
              sx={{
                minWidth: 0,
                gridColumn:
                  checks.length % 2 === 1 && index === checks.length - 1 ? "1 / -1" : "auto",
                px: 1,
                py: 0.75,
                borderRadius: 1.5,
                bgcolor: "rgba(255, 255, 255, 0.025)",
              }}
            >
              <Icon
                sx={{
                  fontSize: 16,
                  flexShrink: 0,
                  color: isValid ? "success.main" : isInvalid ? "error.main" : "text.secondary",
                }}
              />
              <Typography
                variant="caption"
                noWrap
                title={`${check.label}: ${check.status}`}
                sx={{ color: isInvalid ? "error.main" : "text.secondary", fontWeight: 600 }}
              >
                {check.label}
              </Typography>
            </Stack>
          );
        })}
      </Box>
    </Stack>
  );
}

ValidationChecklist.propTypes = {
  checks: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      status: PropTypes.oneOf(["pending", "valid", "invalid"]).isRequired,
    }),
  ).isRequired,
};

export default ValidationChecklist;
