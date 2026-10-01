/** How much of the original posting shows before "Show more". */
export const ORIGINAL_PREVIEW_CHARS = 360;

export type OriginalDescription = {
  /** Paragraphs to render now: the first few words when collapsed, all of it when open. */
  paragraphs: string[];
  /** False when the whole posting already fits in the preview. */
  isTruncatable: boolean;
};

/** Splits the posting into paragraphs and, unless `isOpen`, cuts it at a word near the preview length. */
export function originalDescription(
  text: string | undefined,
  isOpen: boolean,
  previewChars = ORIGINAL_PREVIEW_CHARS,
): OriginalDescription {
  const full = (text ?? "").trim();
  const split = (value: string) => value.split(/\n+/).filter((line) => line.trim());
  if (full.length <= previewChars) return { paragraphs: split(full), isTruncatable: false };
  if (isOpen) return { paragraphs: split(full), isTruncatable: true };
  const cut = full.slice(0, previewChars);
  const atWord = cut.replace(/\s+\S*$/, "");
  return { paragraphs: split(`${atWord || cut}…`), isTruncatable: true };
}
