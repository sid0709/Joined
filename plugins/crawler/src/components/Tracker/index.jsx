import { useState, useEffect } from "react";
import { useRuntime } from "../../api/runtimeContext";
import useNotification from "../../api/useNotification";
import {
  Box,
  Paper,
  TextField,
  Button,
  Stack,
  Select,
  Typography,
  FormControl,
  InputLabel,
  MenuItem,
  Tooltip,
  Divider,
} from "@mui/material";

import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";

import { handleAction, handleClear, handleHighlight } from "../../contentScript/interactionBridge";
import { commonTags, commonProperties } from "../../contentScript/interactionBridge";
import { athensCardSx, athensSectionLabelSx } from "../../theme/athensTheme";

const ComponentTracker = () => {
  // State for highlighting
  const [tag, setTag] = useState("div");
  const [property, setProperty] = useState("class");
  const [pattern, setPattern] = useState("");
  const [order, setOrder] = useState(0);
  const [action, setAction] = useState("click");
  const [actionValue, setActionValue] = useState(""); // For fill/type actions
  const [fetchType, setFetchType] = useState("content");
  const [fetchResult, setFetchResult] = useState(null);

  // Subscribe to runtime messages via the RuntimeProvider so only one
  // chrome.runtime.onMessage listener exists at the app root.
  const { addListener, removeListener } = useRuntime();
  const notification = useNotification();
  useEffect(() => {
    const listener = (message) => {
      if (message?.action === "fetchResult") {
        setFetchResult(message.payload);
        if (message.payload?.success === false) {
          notification.fail(message.payload?.error || "Fetch failed");
        }
      }
      if (message?.action === "highlightResult") {
        const { success, matched, highlighted, error } = message.payload || {};
        if (success === false) {
          notification.fail(error || "Highlight failed");
          return;
        }
        if (!matched) {
          notification.warning("No elements matched that pattern.");
        } else if (!highlighted) {
          notification.warning(`Found ${matched} match(es), but none were visible to outline.`);
        } else {
          notification.success(`Highlighted ${highlighted} element(s).`);
        }
      }
    };
    addListener(listener);
    return () => removeListener(listener);
  }, [addListener, removeListener, notification]);

  const isActionWithValue = action === "fill" || action === "typeSmoothly";
  const isFetchAction = action === "fetch";

  return (
    <div>
      <Paper sx={athensCardSx}>
        <Stack spacing={3}>
          <Box>
            <Typography sx={athensSectionLabelSx} component="p" gutterBottom>
              Step 1
            </Typography>
            <Typography variant="h6">Find Elements</Typography>
          </Box>
          <FormControl fullWidth>
            <InputLabel>Tag Name</InputLabel>
            <Select value={tag} label="Tag Name" onChange={(e) => setTag(e.target.value)}>
              {commonTags.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Attribute</InputLabel>
            <Select
              value={property}
              label="Attribute"
              onChange={(e) => setProperty(e.target.value)}
            >
              {commonProperties.map((p) => (
                <MenuItem key={p} value={p}>
                  {p}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Tooltip title="Use '?' for wildcards. `?text?` contains, `text?` starts-with." arrow>
            <TextField
              fullWidth
              label="Pattern"
              variant="outlined"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="e.g., ?user-profile?"
            />
          </Tooltip>
          <Stack direction="row" spacing={1.5}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<SearchIcon />}
              onClick={() => handleHighlight(tag, property, pattern)}
              disabled={!pattern}
            >
              Highlight
            </Button>
            <Button fullWidth variant="outlined" startIcon={<ClearIcon />} onClick={handleClear}>
              Clear
            </Button>
          </Stack>

          <Divider />

          <Box>
            <Typography sx={athensSectionLabelSx} component="p" gutterBottom>
              Step 2
            </Typography>
            <Typography variant="h6">Interact with Element</Typography>
          </Box>

          <Stack direction="row" spacing={2}>
            <TextField
              type="number"
              label="Order"
              value={order}
              onChange={(e) => setOrder(Math.max(0, parseInt(e.target.value, 10)))}
              inputProps={{ min: 0 }}
              sx={{ width: "100px" }}
              disabled={!pattern}
            />
            <FormControl fullWidth disabled={!pattern}>
              <InputLabel>Action</InputLabel>
              <Select value={action} label="Action" onChange={(e) => setAction(e.target.value)}>
                <MenuItem value="click">Click</MenuItem>
                <MenuItem value="fill">Fill</MenuItem>
                <MenuItem value="typeSmoothly">Type Smoothly</MenuItem>
                <MenuItem value="fetch">Fetch</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          {isActionWithValue && (
            <TextField
              fullWidth
              label="Value to Fill/Type"
              variant="outlined"
              value={actionValue}
              onChange={(e) => setActionValue(e.target.value)}
              disabled={!pattern}
            />
          )}

          {/* Fetch-specific controls */}
          {isFetchAction && (
            <>
              <FormControl fullWidth>
                <InputLabel>Fetch Type</InputLabel>
                <Select
                  value={fetchType}
                  label="Fetch Type"
                  onChange={(e) => setFetchType(e.target.value)}
                >
                  <MenuItem value="content">Content (innerHTML)</MenuItem>
                  <MenuItem value="text">Text (innerText)</MenuItem>
                </Select>
              </FormControl>
              {fetchResult && (
                <TextField
                  fullWidth
                  label="Fetch Result"
                  multiline
                  minRows={3}
                  value={fetchResult.error ? `Error: ${fetchResult.error}` : fetchResult.data || ""}
                  InputProps={{ readOnly: true }}
                />
              )}
            </>
          )}

          <Button
            variant="contained"
            color="success"
            startIcon={<PlayArrowIcon />}
            onClick={() =>
              handleAction(tag, property, pattern, order, action, actionValue, fetchType)
            }
            disabled={!pattern || (isActionWithValue && !actionValue)}
            fullWidth
            sx={{ mt: 0.5 }}
          >
            Execute Action
          </Button>
        </Stack>
      </Paper>
    </div>
  );
};

export default ComponentTracker;
