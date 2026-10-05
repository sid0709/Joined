import { waitingDraftCount, type JobDraft } from "../drafts";

export type BadgeAuthStatus = "signed-in" | "signed-out" | "error" | "loading";

/** Chrome `action.setBadge*` ColorArray. */
export type BadgeColor = [number, number, number, number];

export interface ToolbarBadgeAppearance {
  text: string;
  backgroundColor: BadgeColor;
  textColor: BadgeColor;
}

/**
 * Chrome's badge API cannot read CSS variables. These RGBA tuples are the
 * light-mode values of `@joined/design-system` tokens in `tokens.css`.
 */
export const BADGE_COLOR_DRAFTS: BadgeColor = [24, 119, 242, 255];
export const BADGE_COLOR_SIGNED_OUT: BadgeColor = [145, 145, 145, 255];
export const BADGE_COLOR_ERROR: BadgeColor = [118, 0, 12, 255];
export const BADGE_TEXT_COLOR: BadgeColor = [255, 255, 255, 255];

export const BADGE_TEXT_SIGNED_OUT = "?";
export const BADGE_TEXT_ERROR = "!";
export const BADGE_TEXT_EMPTY = "";
export const BADGE_MAX_COUNT = 99;
export const BADGE_OVERFLOW_TEXT = "99+";

export function formatWaitingDraftBadgeText(count: number): string {
  if (count <= 0) {
    return BADGE_TEXT_EMPTY;
  }
  if (count > BADGE_MAX_COUNT) {
    return BADGE_OVERFLOW_TEXT;
  }
  return String(count);
}

export function toolbarBadgeAppearance(
  auth: BadgeAuthStatus,
  drafts: readonly JobDraft[],
): ToolbarBadgeAppearance {
  switch (auth) {
    case "signed-out":
      return {
        text: BADGE_TEXT_SIGNED_OUT,
        backgroundColor: BADGE_COLOR_SIGNED_OUT,
        textColor: BADGE_TEXT_COLOR,
      };
    case "error":
      return {
        text: BADGE_TEXT_ERROR,
        backgroundColor: BADGE_COLOR_ERROR,
        textColor: BADGE_TEXT_COLOR,
      };
    case "loading":
      return {
        text: BADGE_TEXT_EMPTY,
        backgroundColor: BADGE_COLOR_DRAFTS,
        textColor: BADGE_TEXT_COLOR,
      };
    case "signed-in":
      return {
        text: formatWaitingDraftBadgeText(waitingDraftCount(drafts)),
        backgroundColor: BADGE_COLOR_DRAFTS,
        textColor: BADGE_TEXT_COLOR,
      };
    default: {
      const _exhaustive: never = auth;
      return _exhaustive;
    }
  }
}
