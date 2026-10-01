"use client";

import type { ReactNode } from "react";
import { Button, HStack, Text, useToast } from "@joined/design-system";

/** The footer strip of a settings group: a quiet hint and the group’s own Save. */
export function SaveFooter({
  hint,
  message,
  action,
}: {
  hint: ReactNode;
  message: string;
  action?: ReactNode;
}) {
  const toast = useToast();
  return (
    <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
      <Text type="supporting" color="secondary">
        {hint}
      </Text>
      {action ?? (
        <Button label="Save" variant="primary" size="sm" onClick={() => toast({ body: message })} />
      )}
    </HStack>
  );
}
