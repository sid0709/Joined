import type { PageRoot } from "../page";
import type { ExtractedFields, JobBoard } from "../types";
import { extractAshby } from "./ashby";
import { extractGreenhouse } from "./greenhouse";
import { extractLever } from "./lever";
import { extractLinkedIn } from "./linkedin";
import { extractWorkday } from "./workday";

export const BOARD_EXTRACTORS = {
  greenhouse: extractGreenhouse,
  lever: extractLever,
  ashby: extractAshby,
  workday: extractWorkday,
  linkedin: extractLinkedIn,
} as const;

export function extractForBoard(board: JobBoard, root: PageRoot, pageUrl: URL): ExtractedFields {
  if (board === "unknown") {
    return {};
  }
  return BOARD_EXTRACTORS[board](root, pageUrl);
}

export { extractAshby } from "./ashby";
export { extractGreenhouse } from "./greenhouse";
export { extractLever } from "./lever";
export { extractLinkedIn } from "./linkedin";
export { extractWorkday } from "./workday";
