/** Whether every id on the current page is already selected. */
export function isPageSelected(selected: readonly string[], pageIds: readonly string[]) {
  if (pageIds.length === 0) return false;
  const chosen = new Set(selected);
  return pageIds.every((id) => chosen.has(id));
}

/**
 * Adds the current page to the selection, or removes it.
 * Ids chosen on other pages stay selected.
 */
export function withPageSelection(
  selected: readonly string[],
  pageIds: readonly string[],
  on: boolean,
) {
  const page = new Set(pageIds);
  if (!on) return selected.filter((id) => !page.has(id));
  const next = new Set(selected);
  for (const id of pageIds) next.add(id);
  return [...next];
}
