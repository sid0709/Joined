"use client";

import { useState, type ReactNode } from "react";
import {
  Avatar,
  Badge,
  Button,
  Divider,
  FormLayout,
  Glyph,
  HStack,
  Heading,
  Stack,
  Text,
} from "sid-ui";
import { FormDialog } from "@/components/form-dialog";
import { SectionCard } from "@/components/section-card";
import type { DateRange } from "@/lib/profile";

const LOGO_SIZE = 48;
const DIALOG_WIDTH = 560;

type TimelineItem = DateRange & { id: string; period: string; summary: string };

/** How one entry reads in the list. */
export type TimelineRow = { title: string; subtitle: string };

/**
 * A newest-first list of dated entries (roles, schools) that can be added,
 * edited, and removed. Every change saves the whole list.
 */
export function TimelineSection<T extends TimelineItem>({
  title,
  description,
  noun,
  emptyText,
  items,
  describe,
  emptyItem,
  isComplete,
  renderFields,
  save,
}: {
  title: string;
  description: string;
  /** "role", "education" — used in buttons, dialog titles, and toasts. */
  noun: string;
  emptyText: string;
  items: T[];
  describe: (item: T) => TimelineRow;
  emptyItem: () => T;
  isComplete: (item: T) => boolean;
  renderFields: (draft: T, setDraft: (draft: T) => void) => ReactNode;
  /** Saves the list and toasts `message`; resolves true on success. */
  save: (items: T[], message: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<T | null>(null);
  const isEditing = Boolean(draft?.id);

  const submit = async () => {
    if (!draft) return;
    const next = isEditing
      ? items.map((item) => (item.id === draft.id ? draft : item))
      : [draft, ...items];
    if (await save(next, `${capitalize(noun)} saved`)) setDraft(null);
  };

  const remove = async (id: string) => {
    await save(
      items.filter((item) => item.id !== id),
      `${capitalize(noun)} removed`,
    );
  };

  return (
    <>
      <SectionCard
        title={title}
        description={description}
        action={
          <Button
            label={`Add ${noun}`}
            variant="secondary"
            size="sm"
            icon={<Glyph name="plus" />}
            onClick={() => setDraft(emptyItem())}
          />
        }
      >
        <Stack gap={5}>
          {items.length === 0 ? (
            <Text color="secondary">{emptyText}</Text>
          ) : (
            items.map((item, index) => {
              const row = describe(item);
              return (
                <Stack key={item.id} gap={5}>
                  {index > 0 ? <Divider /> : null}
                  <HStack gap={4} vAlign="start" hAlign="between">
                    <HStack gap={4} vAlign="start">
                      <Avatar
                        name={row.subtitle || row.title}
                        size={LOGO_SIZE}
                        shape="rounded"
                        tooltip={false}
                      />
                      <Stack gap={1}>
                        <HStack gap={2} vAlign="center" wrap="wrap">
                          <Heading level={3}>{row.title}</Heading>
                          {item.current ? <Badge label="Current" variant="blue" /> : null}
                        </HStack>
                        <Text color="secondary" display="block">
                          {[row.subtitle, item.period].filter(Boolean).join(" · ")}
                        </Text>
                        {item.summary ? <Text display="block">{item.summary}</Text> : null}
                      </Stack>
                    </HStack>
                    <HStack gap={1}>
                      <Button
                        label={`Edit ${noun}`}
                        icon={<Glyph name="edit" />}
                        isIconOnly
                        variant="ghost"
                        size="sm"
                        tooltip="Edit"
                        onClick={() => setDraft(item)}
                      />
                      <Button
                        label={`Remove ${noun}`}
                        icon={<Glyph name="trash" />}
                        isIconOnly
                        variant="ghost"
                        size="sm"
                        tooltip="Remove"
                        clickAction={() => remove(item.id)}
                      />
                    </HStack>
                  </HStack>
                </Stack>
              );
            })
          )}
        </Stack>
      </SectionCard>
      <FormDialog
        isOpen={draft !== null}
        onOpenChange={(isOpen) => !isOpen && setDraft(null)}
        title={isEditing ? `Edit ${noun}` : `Add ${noun}`}
        submitLabel={`Save ${noun}`}
        onSubmit={submit}
        isSubmitDisabled={!draft || !isComplete(draft)}
        width={DIALOG_WIDTH}
      >
        <FormLayout>{draft ? renderFields(draft, setDraft) : null}</FormLayout>
      </FormDialog>
    </>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
