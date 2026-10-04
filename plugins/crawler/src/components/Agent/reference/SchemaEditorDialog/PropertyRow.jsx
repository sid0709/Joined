import React from "react";
import {
  Box,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import DataArrayIcon from "@mui/icons-material/DataArray";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import { Star } from "@mui/icons-material";

const DATA_TYPES = ["string", "number", "integer", "boolean", "object", "enum"];

const PropertyRow = ({
  propName,
  propDef,
  isRequired,
  onNameChange,
  onDefChange,
  onDelete,
  onToggleRequired,
}) => {
  const isArray = propDef?.type === "array";
  const currentDef = isArray ? propDef.items || { type: "string" } : propDef || { type: "string" };

  const effectiveType = currentDef.enum ? "enum" : currentDef.type || "string";

  const commitDef = (def) => {
    const next = isArray ? { type: "array", items: def } : def;
    onDefChange(next);
  };

  const handleTypeChange = (newType) => {
    let newDef;
    if (newType === "object") {
      newDef = { type: "object", properties: {}, description: currentDef.description || "" };
    } else if (newType === "enum") {
      newDef = { type: "string", description: currentDef.description || "", enum: ["value1"] };
    } else {
      newDef = { type: newType, description: currentDef.description || "" };
    }
    commitDef(newDef);
  };

  const handleToggleArray = () => {
    if (isArray) {
      // unwrap
      onDefChange({ ...currentDef });
    } else {
      onDefChange({ type: "array", items: { ...currentDef } });
    }
  };

  const handleEnumChange = (idx, value) => {
    const newEnums = [...(currentDef.enum || [])];
    newEnums[idx] = value;
    const newDef = { ...currentDef, enum: newEnums };
    commitDef(newDef);
  };

  const addEnum = () => {
    const newEnums = [...(currentDef.enum || []), "newValue"];
    const newDef = { ...currentDef, enum: newEnums };
    commitDef(newDef);
  };

  const deleteEnum = (idx) => {
    const newEnums = (currentDef.enum || []).filter((_, i) => i !== idx);
    const newDef = { ...currentDef };
    if (newEnums.length) newDef.enum = newEnums;
    else delete newDef.enum;
    commitDef(newDef);
  };

  return (
    <Stack spacing={1} sx={{ p: 1, border: "1px solid #eee", borderRadius: 1 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <TextField
          label="Property"
          size="small"
          defaultValue={propName}
          onBlur={(e) => onNameChange(e.target.value)}
          sx={{ flex: 1 }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Type</InputLabel>
          <Select
            label="Type"
            value={effectiveType}
            onChange={(e) => handleTypeChange(e.target.value)}
          >
            {DATA_TYPES.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Tooltip title="Is Array">
          <IconButton onClick={handleToggleArray} color={isArray ? "primary" : "default"}>
            <DataArrayIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Is Required">
          <IconButton onClick={onToggleRequired} color={isRequired ? "primary" : "default"}>
            <Star />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton onClick={onDelete}>
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      <TextField
        label="Description"
        size="small"
        fullWidth
        value={currentDef.description || ""}
        onChange={(e) => commitDef({ ...currentDef, description: e.target.value })}
      />

      {effectiveType === "enum" && (
        <Box>
          <Typography variant="overline" color="text.secondary">
            Allowed Values (Enum)
          </Typography>
          <Stack spacing={1}>
            {(currentDef.enum || []).map((v, i) => (
              <Stack key={i} direction="row" spacing={1}>
                <TextField
                  size="small"
                  fullWidth
                  value={v}
                  onChange={(e) => handleEnumChange(i, e.target.value)}
                />
                <IconButton size="small" onClick={() => deleteEnum(i)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}
            <IconButton size="small" onClick={addEnum}>
              <AddCircleOutlineIcon />
            </IconButton>
          </Stack>
        </Box>
      )}
    </Stack>
  );
};

export default PropertyRow;
