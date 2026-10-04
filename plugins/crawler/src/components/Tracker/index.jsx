import {
  Button,
  Card,
  Glyph,
  HStack,
  NumberInput,
  Selector,
  Text,
  TextArea,
  TextInput,
  VStack,
} from "@joined/design-system";
import { useState, useEffect } from "react";

import { useRuntime } from "../../api/runtimeContext";
import useNotification from "../../api/useNotification";
import { handleAction, handleClear, handleHighlight } from "../../contentScript/interactionBridge";
import { commonTags, commonProperties } from "../../contentScript/interactionBridge";

const ACTION_OPTIONS = [
  { value: "click", label: "Click" },
  { value: "fill", label: "Fill" },
  { value: "typeSmoothly", label: "Type Smoothly" },
  { value: "fetch", label: "Fetch" },
];

const FETCH_TYPE_OPTIONS = [
  { value: "content", label: "Content (innerHTML)" },
  { value: "text", label: "Text (innerText)" },
];

function StepHeading({ step, title }) {
  return (
    <VStack gap={1}>
      <Text type="supporting" weight="semibold" color="secondary">
        {step}
      </Text>
      <Text as="h2" type="large" weight="semibold">
        {title}
      </Text>
    </VStack>
  );
}

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
    <Card padding={4}>
      <VStack gap={5}>
        <StepHeading step="Step 1" title="Find Elements" />
        <Selector label="Tag Name" options={commonTags} value={tag} onChange={setTag} />
        <Selector
          label="Attribute"
          options={commonProperties}
          value={property}
          onChange={setProperty}
        />
        <TextInput
          label="Pattern"
          labelTooltip="Use '?' for wildcards. `?text?` contains, `text?` starts-with."
          value={pattern}
          onChange={setPattern}
          placeholder="e.g., ?user-profile?"
        />
        <HStack gap={3}>
          <Button
            variant="primary"
            label="Highlight"
            icon={<Glyph name="search" />}
            onClick={() => handleHighlight(tag, property, pattern)}
            isDisabled={!pattern}
            width="100%"
          />
          <Button
            variant="secondary"
            label="Clear"
            icon={<Glyph name="close" />}
            onClick={handleClear}
            width="100%"
          />
        </HStack>

        <hr className="crawler-divider" />

        <StepHeading step="Step 2" title="Interact with Element" />

        <HStack gap={4}>
          <NumberInput
            label="Order"
            value={order}
            onChange={(value) => setOrder(Math.max(0, parseInt(value, 10)))}
            min={0}
            width="100px"
            isDisabled={!pattern}
          />
          <Selector
            label="Action"
            options={ACTION_OPTIONS}
            value={action}
            onChange={setAction}
            isDisabled={!pattern}
            width="100%"
          />
        </HStack>

        {isActionWithValue && (
          <TextInput
            label="Value to Fill/Type"
            value={actionValue}
            onChange={setActionValue}
            isDisabled={!pattern}
          />
        )}

        {/* Fetch-specific controls */}
        {isFetchAction && (
          <>
            <Selector
              label="Fetch Type"
              options={FETCH_TYPE_OPTIONS}
              value={fetchType}
              onChange={setFetchType}
            />
            {fetchResult && (
              <TextArea
                label="Fetch Result"
                rows={3}
                value={fetchResult.error ? `Error: ${fetchResult.error}` : fetchResult.data || ""}
                isReadOnly
              />
            )}
          </>
        )}

        <Button
          variant="primary"
          label="Execute Action"
          icon={<Glyph name="play" />}
          onClick={() =>
            handleAction(tag, property, pattern, order, action, actionValue, fetchType)
          }
          isDisabled={!pattern || (isActionWithValue && !actionValue)}
          width="100%"
        />
      </VStack>
    </Card>
  );
};

export default ComponentTracker;
