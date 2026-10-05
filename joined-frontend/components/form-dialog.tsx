"use client";

import type { ReactNode } from "react";
import { Button, Dialog, DialogHeader, HStack, Layout, LayoutContent, LayoutFooter } from "sid-ui";

const DIALOG_WIDTH = 480;

/** A modal form: header, fields, Cancel + primary action. */
export function FormDialog({
  isOpen,
  onOpenChange,
  title,
  subtitle,
  submitLabel,
  onSubmit,
  isSubmitDisabled,
  width = DIALOG_WIDTH,
  children,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  subtitle?: string;
  submitLabel: string;
  onSubmit: () => void;
  isSubmitDisabled?: boolean;
  width?: number;
  children: ReactNode;
}) {
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" width={width}>
      <Layout
        height="auto"
        header={
          <DialogHeader title={title} subtitle={subtitle} onOpenChange={onOpenChange} hasDivider />
        }
        content={<LayoutContent>{children}</LayoutContent>}
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} hAlign="end">
              <Button label="Cancel" variant="ghost" onClick={() => onOpenChange(false)} />
              <Button
                label={submitLabel}
                variant="primary"
                isDisabled={isSubmitDisabled}
                onClick={onSubmit}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
