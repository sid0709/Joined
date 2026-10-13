import { queryAll } from "../../routineKit/extract.js";
import { SCROLL_BLOCK, SCROLL_INLINE } from "../../routines/builtin/constants.js";

export function scrollElementIntoView(
  root,
  { selector, nth = 0, block = SCROLL_BLOCK, inline = SCROLL_INLINE } = {},
) {
  const target = queryAll(root, selector)[nth];
  if (!target) return { found: false };
  target.scrollIntoView?.({ block, inline });
  return { found: true };
}
