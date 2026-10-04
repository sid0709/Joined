// src/ResponseTreeView.jsx

import * as React from "react";
import { styled } from "@mui/material/styles";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

// --- Import necessary icons for different data types ---
import InfoIcon from "@mui/icons-material/Info"; // For simple key-value pairs
import AccountTreeIcon from "@mui/icons-material/AccountTree"; // For objects/branches
import ListAltIcon from "@mui/icons-material/ListAlt"; // For arrays
import NotesIcon from "@mui/icons-material/Notes"; // For items within an array
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ArrowRightIcon from "@mui/icons-material/ArrowRight";

import { SimpleTreeView } from "@mui/x-tree-view/SimpleTreeView";
import {
  TreeItemContent,
  TreeItemIconContainer,
  TreeItemRoot,
  TreeItemGroupTransition,
} from "@mui/x-tree-view/TreeItem";
import { useTreeItem } from "@mui/x-tree-view/useTreeItem";
import { TreeItemProvider } from "@mui/x-tree-view/TreeItemProvider";
import { TreeItemIcon } from "@mui/x-tree-view/TreeItemIcon";

// --- CustomTreeItem styling and logic (remains unchanged) ---
const CustomTreeItemRoot = styled(TreeItemRoot)({/* ... keep the same styling ... */});

const CustomTreeItemContent = styled(TreeItemContent)(({ theme }) => ({
  marginBottom: theme.spacing(0.3),
  color: (theme.vars || theme).palette.text.secondary,
  borderRadius: 10,
  paddingRight: theme.spacing(1),
  paddingLeft: `calc(${theme.spacing(1)} + var(--TreeView-itemChildrenIndentation) * var(--TreeView-itemDepth))`,
  fontWeight: theme.typography.fontWeightMedium,
  fontSize: "0.8125rem",
  "&[data-expanded]": {
    fontWeight: theme.typography.fontWeightRegular,
  },
  "&:hover": {
    backgroundColor: "rgba(124, 110, 245, 0.08)",
  },
  "&[data-focused], &[data-selected], &[data-selected][data-focused]": {
    backgroundColor: "rgba(124, 110, 245, 0.12)",
    color: (theme.vars || theme).palette.primary.main,
  },
}));

const CustomTreeItemIconContainer = styled(TreeItemIconContainer)(({ theme }) => ({
  marginRight: theme.spacing(1),
}));

const CustomTreeItem = React.forwardRef(function CustomTreeItem(props, ref) {
  const { id, itemId, label, disabled, children, labelIcon: LabelIcon, ...other } = props;
  const {
    getContextProviderProps,
    getRootProps,
    getContentProps,
    getIconContainerProps,
    getLabelProps,
    getGroupTransitionProps,
    status,
  } = useTreeItem({ id, itemId, children, label, disabled, rootRef: ref });
  return (
    <TreeItemProvider {...getContextProviderProps()}>
      <CustomTreeItemRoot {...getRootProps(other)}>
        <CustomTreeItemContent {...getContentProps()}>
          <CustomTreeItemIconContainer {...getIconContainerProps()}>
            <TreeItemIcon status={status} />
          </CustomTreeItemIconContainer>
          <Box sx={{ display: "flex", flexGrow: 1, alignItems: "center", p: 0.5, pr: 0 }}>
            <Box component={LabelIcon} color="inherit" sx={{ mr: 1 }} />
            <Typography
              {...getLabelProps({
                variant: "body2",
                sx: { fontWeight: "inherit", flexGrow: 1, whiteSpace: "normal" },
              })}
            />
          </Box>
        </CustomTreeItemContent>
        {children && <TreeItemGroupTransition {...getGroupTransitionProps()} />}
      </CustomTreeItemRoot>
    </TreeItemProvider>
  );
});

// --- The CORRECTED dynamic, recursive rendering function ---

// Helper function to render the properties of an object
const renderObjectProperties = (data, parentId) => {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return (
      <CustomTreeItem
        itemId={`${parentId}-empty`}
        label="(empty object)"
        labelIcon={InfoIcon}
        disabled
      />
    );
  }
  return entries.map(([key, value]) => renderJsonNode(value, key, `${parentId}-${key}`));
};

// Main recursive function
const renderJsonNode = (data, keyName, nodeId) => {
  // --- Case 1: The data is an Array ---
  if (Array.isArray(data)) {
    return (
      <CustomTreeItem key={nodeId} itemId={nodeId} label={keyName} labelIcon={ListAltIcon}>
        {data.length > 0 ? (
          data.map((item, index) => {
            // Here's the key fix: We render each array item as a new node.
            // The item itself doesn't have a "keyName", so we create one.
            const itemNodeId = `${nodeId}-${index}`;
            const itemLabel = `[Item ${index + 1}]`;
            return renderJsonNode(item, itemLabel, itemNodeId);
          })
        ) : (
          <CustomTreeItem
            itemId={`${nodeId}-empty`}
            label="(empty array)"
            labelIcon={NotesIcon}
            disabled
          />
        )}
      </CustomTreeItem>
    );
  }

  // --- Case 2: The data is a nested Object ---
  if (typeof data === "object" && data !== null) {
    return (
      <CustomTreeItem key={nodeId} itemId={nodeId} label={keyName} labelIcon={AccountTreeIcon}>
        {/* Use the helper to render its children */}
        {renderObjectProperties(data, nodeId)}
      </CustomTreeItem>
    );
  }

  // --- Case 3: The data is a primitive (string, number, boolean) ---
  // This will render leaf nodes like "Fieldname: First Name"
  return (
    <CustomTreeItem
      key={nodeId}
      itemId={nodeId}
      label={`${keyName}: ${String(data)}`}
      labelIcon={InfoIcon}
    />
  );
};

// --- The Main Component ---
export default function ResponseTreeView({ data }) {
  if (!data || typeof data !== "object") {
    return <Typography>No valid data to display.</Typography>;
  }

  return (
    <SimpleTreeView
      aria-label="dynamic-json-response"
      defaultExpandedItems={Object.keys(data).map((key) => `root-${key}`)} // Simplified default expansion
      slots={{
        expandIcon: ArrowRightIcon,
        collapseIcon: ArrowDropDownIcon,
      }}
      sx={{
        flexGrow: 1,
        overflowY: "auto",
        maxHeight: 320,
        p: 1,
        borderRadius: 2.5,
        bgcolor: "secondary.main",
        border: "1px solid",
        borderColor: "divider",
      }}
      itemChildrenIndentation={20}
    >
      {/* Start the rendering process by mapping over the top-level keys */}
      {renderObjectProperties(data, "root")}
    </SimpleTreeView>
  );
}
