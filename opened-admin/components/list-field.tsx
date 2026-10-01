"use client";

import { useState } from "react";
import { TextArea } from "@joined/design-system";

/**
 * A list edited as one item per line. The raw text is kept as typed, so a
 * blank line while starting a new item is not stripped from under the cursor;
 * the cleaned list is what the parent receives.
 */
export function ListField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
}) {
  const [text, setText] = useState(() => value.join("\n"));
  return (
    <TextArea
      label={label}
      value={text}
      placeholder={placeholder}
      description="One per line."
      onChange={(next) => {
        setText(next);
        onChange(
          next
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
        );
      }}
    />
  );
}
