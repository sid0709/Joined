import {
  Button,
  Paper,
  Box,
  Stack,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import ResponseTreeView from "./reference/ResponseTreeView.jsx";
import { athensCardSx, athensSectionLabelSx } from "../../theme/athensTheme";

export function AgentUI({
  onAnalyze,
  onExecute,
  loading,
  executing,
  error,
  profiles,
  profileIdentifier,
  onProfileChange,
  jobDescription,
  onJobDescriptionChange,
  componentsData,
  analysisData,
  hasExecutableActions,
  executionReport,
}) {
  return (
    <Box sx={{ p: 2, maxWidth: 1000, margin: "auto" }}>
      <Paper sx={{ ...athensCardSx, mb: 2 }}>
        <Stack spacing={2.5}>
          <Box>
            <Typography sx={athensSectionLabelSx} component="p" gutterBottom>
              AI Agent
            </Typography>
            <Typography variant="h5">Agent</Typography>
          </Box>

          <FormControl fullWidth>
            <InputLabel id="autolancer-profile-select-label">Profile</InputLabel>
            <Select
              labelId="autolancer-profile-select-label"
              label="Profile"
              value={profileIdentifier || ""}
              onChange={(e) => onProfileChange?.(e.target.value)}
            >
              {(profiles || []).map((p) => (
                <MenuItem key={p.identifier} value={p.identifier}>
                  {p.label || p.identifier}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Job Description (optional)"
            placeholder="Paste the job description here to improve AI answers"
            value={jobDescription}
            onChange={(e) => onJobDescriptionChange?.(e.target.value)}
            multiline
            minRows={4}
            fullWidth
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button
              variant="contained"
              color="primary"
              onClick={onAnalyze}
              fullWidth
              disabled={loading}
            >
              Highlight & Collect
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={onExecute}
              fullWidth
              disabled={!hasExecutableActions || loading || executing}
            >
              {executing ? "Executing..." : "Execute Actions"}
            </Button>
          </Stack>
          {loading && (
            <Typography variant="body2" color="text.secondary">
              Analyzing with AI...
            </Typography>
          )}
          {executing && (
            <Typography variant="body2" color="text.secondary">
              Filling text fields...
            </Typography>
          )}
          {error && (
            <Box
              sx={{
                px: 1.5,
                py: 1.25,
                borderRadius: 2.5,
                border: "1px solid",
                borderColor: "error.main",
                bgcolor: "rgba(248, 113, 113, 0.08)",
              }}
            >
              <Typography variant="body2" color="error">
                {String(error)}
              </Typography>
            </Box>
          )}
        </Stack>
      </Paper>

      {componentsData && (
        <Paper sx={{ ...athensCardSx, mb: 2 }}>
          <Typography sx={{ ...athensSectionLabelSx, mb: 1.5 }} component="p">
            Detected
          </Typography>
          <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
            Detected Components
          </Typography>
          <ResponseTreeView data={componentsData} />
        </Paper>
      )}

      {analysisData && (
        <Paper sx={athensCardSx}>
          <Typography sx={{ ...athensSectionLabelSx, mb: 1.5 }} component="p">
            Analysis
          </Typography>
          <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
            AI Analysis
          </Typography>
          <ResponseTreeView data={analysisData} />
        </Paper>
      )}

      {executionReport && (
        <Paper sx={{ ...athensCardSx, mt: 2 }}>
          <Typography sx={{ ...athensSectionLabelSx, mb: 1.5 }} component="p">
            Result
          </Typography>
          <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
            Execution Result
          </Typography>
          <ResponseTreeView data={executionReport} />
        </Paper>
      )}
    </Box>
  );
}
