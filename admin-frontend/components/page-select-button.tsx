"use client";

import { Button } from "sid-ui";
import { isPageSelected, withPageSelection } from "@/lib/page-selection";

type PageSelectButtonProps = {
  selected: readonly string[];
  pageIds: readonly string[];
  onChange: (ids: string[]) => void;
};

/** Selects every row currently shown, or drops those rows from the selection. */
export function PageSelectButton({ selected, pageIds, onChange }: PageSelectButtonProps) {
  const pageSelected = isPageSelected(selected, pageIds);
  return (
    <Button
      label={pageSelected ? "Clear" : "Select all"}
      variant="secondary"
      size="sm"
      isDisabled={pageIds.length === 0}
      clickAction={() => onChange(withPageSelection(selected, pageIds, !pageSelected))}
    />
  );
}
