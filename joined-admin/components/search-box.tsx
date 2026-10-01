"use client";

import { useEffect, useState } from "react";
import { Icon, TextInput, icons } from "@joined/design-system";
import { SEARCH_DEBOUNCE_MS } from "@/lib/config";

/** A search field that reports its value a moment after typing stops. */
export function SearchBox({
  value,
  label,
  placeholder,
  onSearch,
}: {
  value: string;
  label: string;
  placeholder: string;
  onSearch: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (draft === value) return;
    const timer = window.setTimeout(() => onSearch(draft), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft, onSearch, value]);
  return (
    <TextInput
      label={label}
      isLabelHidden
      value={draft}
      onChange={setDraft}
      placeholder={placeholder}
      startIcon={<Icon icon={icons.search} />}
      hasClear
      width="100%"
    />
  );
}
