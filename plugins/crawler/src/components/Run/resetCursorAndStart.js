/** Reset the Built In page cursor, then start the run. */
export async function resetCursorAndStart(store, onStart) {
  await store.resetToPage1();
  await onStart?.();
}
