import type { PageRoot } from "../page";
import type { ExtractedFields, JobBoard, KnownJobBoard } from "../types";
import { extractAshby } from "./ashby";
import { extractBambooHr } from "./bamboohr";
import { extractGreenhouse } from "./greenhouse";
import { extractIcims } from "./icims";
import { extractJobvite } from "./jobvite";
import { extractLever } from "./lever";
import { extractLinkedIn } from "./linkedin";
import { extractRecruitee } from "./recruitee";
import { extractSmartRecruiters } from "./smartrecruiters";
import { extractWorkable } from "./workable";
import { extractWorkday } from "./workday";

type BoardExtractor = (root: PageRoot, pageUrl: URL) => ExtractedFields;

export const BOARD_EXTRACTORS: Record<KnownJobBoard, BoardExtractor> = {
  greenhouse: extractGreenhouse,
  lever: extractLever,
  ashby: extractAshby,
  workday: extractWorkday,
  linkedin: extractLinkedIn,
  smartrecruiters: extractSmartRecruiters,
  icims: extractIcims,
  workable: extractWorkable,
  bamboohr: extractBambooHr,
  jobvite: extractJobvite,
  recruitee: extractRecruitee,
};

export function extractForBoard(board: JobBoard, root: PageRoot, pageUrl: URL): ExtractedFields {
  if (board === "unknown") {
    return {};
  }
  return BOARD_EXTRACTORS[board](root, pageUrl);
}

export { extractAshby } from "./ashby";
export { extractBambooHr } from "./bamboohr";
export { extractGreenhouse } from "./greenhouse";
export { extractIcims } from "./icims";
export { extractJobvite } from "./jobvite";
export { extractLever } from "./lever";
export { extractLinkedIn } from "./linkedin";
export { extractRecruitee } from "./recruitee";
export { extractSmartRecruiters } from "./smartrecruiters";
export { extractWorkable } from "./workable";
export { extractWorkday } from "./workday";
