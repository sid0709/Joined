import { Button, Divider, Typography, Paper, Stack, Box } from "@mui/material";
import { PlayArrow, Stop } from "@mui/icons-material";
import ScrapeSourceBadge from "../../ScrapeSourceBadge";
import { athensCardSx, athensSectionLabelSx } from "../../../theme/athensTheme";
import CircularProgressWithLabel from "./CircularProgressWithLabel";
import RunSummary from "./RunSummary";
import ValidationChecklist from "./ValidationChecklist";
import { useScrapeRun } from "./useScrapeRun";

const ScrapComponent = () => {
  const {
    progress,
    scrapFlag,
    starting,
    validationChecks,
    runStats,
    elapsedMs,
    targetTab,
    queueCounts,
    onScrapStart,
    onScrapStop,
  } = useScrapeRun();

  return (
    <Paper sx={{ ...athensCardSx, mx: "auto" }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography sx={athensSectionLabelSx} component="p" gutterBottom>
            Automation
          </Typography>
          <Typography variant="h5" component="h2">
            Scraping Controls
          </Typography>
          <Box sx={{ mt: 1.25 }}>
            <ScrapeSourceBadge />
          </Box>
        </Box>
        <Divider />

        <Stack
          spacing={2}
          alignItems="center"
          sx={{
            p: 2,
            borderRadius: 3,
            bgcolor: "secondary.main",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <CircularProgressWithLabel size={72} value={progress} thickness={4} />
          <ValidationChecklist checks={validationChecks} />
          <Divider flexItem />
          <RunSummary
            elapsedMs={elapsedMs}
            stats={runStats}
            targetTab={targetTab}
            queue={queueCounts}
          />
        </Stack>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            color="error"
            onClick={onScrapStop}
            disabled={!scrapFlag}
            startIcon={<Stop />}
            fullWidth
          >
            Stop
          </Button>
          <Button
            variant="contained"
            onClick={onScrapStart}
            disabled={scrapFlag || starting}
            startIcon={<PlayArrow />}
            fullWidth
          >
            {starting ? "Remembering…" : "Start"}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
};

export default ScrapComponent;
