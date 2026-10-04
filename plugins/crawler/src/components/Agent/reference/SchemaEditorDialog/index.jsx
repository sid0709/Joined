import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tabs,
  Tab,
  Box,
  TextField,
} from "@mui/material";
import RecursiveObjectEditor from "./RecursiveObjectEditor";

const normalizeRoot = (schema) => {
  if (!schema || typeof schema !== "object")
    return { type: "object", properties: {}, required: [] };
  if (schema.type === "object") return { properties: {}, required: [], ...schema };
  // Wrap non-object schema into an object with a single field 'value'
  return { type: "object", properties: { value: schema }, required: [] };
};

const SchemaEditorDialog = ({ open, onClose, schema, onSave }) => {
  const [tab, setTab] = useState(0); // 0: Form, 1: JSON
  const [root, setRoot] = useState(normalizeRoot(schema));
  const [json, setJson] = useState("");
  const [jsonError, setJsonError] = useState("");

  useEffect(() => {
    setRoot(normalizeRoot(schema));
  }, [schema]);

  useEffect(() => {
    setJson(JSON.stringify(root, null, 2));
  }, [root]);

  const handleSave = () => {
    let result = root;
    if (tab === 1) {
      try {
        result = JSON.parse(json);
        setJsonError("");
      } catch (e) {
        setJsonError(String(e?.message || e));
        return;
      }
    }
    onSave && onSave(result);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Structured Output</DialogTitle>
      <DialogContent>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="Form" />
          <Tab label="JSON" />
        </Tabs>
        {tab === 0 ? (
          <Box>
            <RecursiveObjectEditor objectSchemaDef={root} onUpdate={setRoot} />
          </Box>
        ) : (
          <Box>
            <TextField
              fullWidth
              multiline
              minRows={12}
              value={json}
              onChange={(e) => setJson(e.target.value)}
            />
            {jsonError && <Box sx={{ color: "error.main", mt: 1 }}>{jsonError}</Box>}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SchemaEditorDialog;
