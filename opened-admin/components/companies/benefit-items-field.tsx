"use client";

import { useState } from "react";
import { Button, Glyph, HStack, IconButton, Stack, Text, TextInput } from "@openseat/design-system";

/** Rows keep their own ids so typing in one never moves the cursor to another. */
type Row = { id: number; text: string };

let nextRowId = 0;
const row = (text: string): Row => ({ id: nextRowId++, text });

/**
 * One benefit per line: each item is its own single-line field. Enter adds the next
 * item; blank rows are left out of what the parent receives.
 */
export function BenefitItemsField({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  const [rows, setRows] = useState<Row[]>(() => (value.length ? value : [""]).map(row));
  const [focusId, setFocusId] = useState<number | null>(null);

  const commit = (next: Row[]) => {
    setRows(next);
    onChange(next.map((item) => item.text.trim()).filter(Boolean));
  };
  const add = (after: number) => {
    const created = row("");
    setFocusId(created.id);
    commit([...rows.slice(0, after + 1), created, ...rows.slice(after + 1)]);
  };

  return (
    <Stack gap={2}>
      <Text type="label" color="secondary">
        Items
      </Text>
      {rows.map((item, index) => (
        <HStack key={item.id} gap={2} vAlign="center">
          <Stack width="100%">
            <TextInput
              label={`Item ${index + 1}`}
              isLabelHidden
              value={item.text}
              placeholder={index === 0 ? placeholder : "Another benefit"}
              hasAutoFocus={item.id === focusId}
              onChange={(text) =>
                // A pasted list still lands one item per line.
                text.includes("\n")
                  ? commit([
                      ...rows.slice(0, index),
                      ...text.split("\n").map(row),
                      ...rows.slice(index + 1),
                    ])
                  : commit(rows.map((other) => (other.id === item.id ? { ...other, text } : other)))
              }
              onEnter={() => add(index)}
            />
          </Stack>
          <IconButton
            label={`Remove item ${index + 1}`}
            icon={<Glyph name="close" />}
            variant="ghost"
            size="sm"
            clickAction={() =>
              commit(rows.length > 1 ? rows.filter((other) => other.id !== item.id) : [row("")])
            }
          />
        </HStack>
      ))}
      <HStack>
        <Button
          label="Add item"
          variant="ghost"
          size="sm"
          icon={<Glyph name="plus" />}
          clickAction={() => add(rows.length - 1)}
        />
      </HStack>
    </Stack>
  );
}
