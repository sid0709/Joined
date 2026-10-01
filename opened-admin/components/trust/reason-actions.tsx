"use client";

import { useState } from "react";
import { Banner, Button, HStack, Selector, Stack, Text, TextArea } from "@joined/design-system";

type Action = {
  id: string;
  label: string;
  variant: "primary" | "secondary" | "destructive";
  needsDisposition?: boolean;
};

/** Reason is required before any trust decision is sent. */
export function ReasonActions({
  description,
  actions,
  dispositions,
  disposition,
  onDisposition,
  pending,
  error,
  onSubmit,
}: {
  description: string;
  actions: Action[];
  dispositions?: { value: string; label: string }[];
  disposition?: string;
  onDisposition?: (value: string) => void;
  pending: boolean;
  error: string;
  onSubmit: (actionId: string, reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState("");
  const ready = reason.trim().length > 0;

  return (
    <Stack gap={3}>
      {error || localError ? <Banner status="error" title={error || localError} /> : null}
      {dispositions && onDisposition ? (
        <Selector
          label="Disposition"
          options={[{ value: "", label: "Choose" }, ...dispositions]}
          value={disposition ?? ""}
          onChange={onDisposition}
        />
      ) : null}
      <TextArea
        label="Reason"
        value={reason}
        onChange={(value) => {
          setReason(value);
          setLocalError("");
        }}
      />
      <Text type="supporting" color="secondary" display="block">
        {description}
      </Text>
      <HStack gap={2} wrap="wrap">
        {actions.map((action) => (
          <Button
            key={action.id}
            label={action.label}
            variant={action.variant}
            isDisabled={pending || !ready || (action.needsDisposition && !disposition)}
            clickAction={() => {
              if (!reason.trim()) {
                setLocalError("Add a reason before submitting.");
                return;
              }
              if (action.needsDisposition && !disposition) {
                setLocalError("Choose removed or draft.");
                return;
              }
              setLocalError("");
              onSubmit(action.id, reason);
            }}
          />
        ))}
      </HStack>
    </Stack>
  );
}
