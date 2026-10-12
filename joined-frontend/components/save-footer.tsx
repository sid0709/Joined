"use client";

import type { ReactNode } from "react";
import { Button, HStack, Text, useToast } from "sid-ui";

/** The footer strip of a settings group or form card: an optional quiet hint and its own Save. */
export function SaveFooter({
  hint,
  message,
  action,
}: {
  hint?: ReactNode;
  message?: string;
  action?: ReactNode;
}) {
  const toast = useToast();
  return (
    <HStack hAlign={hint ? "between" : "end"} vAlign="center" gap={3} wrap="wrap">
      {hint ? (
        <Text type="supporting" color="secondary">
          {hint}
        </Text>
      ) : null}
      {action ?? (
        <Button label="Save" variant="primary" size="sm" onClick={() => toast({ body: message })} />
      )}
    </HStack>
  );
}
