import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";

/** Meta / Facebook blue — light scheme primary */
export const ACCENT_LIGHT = "#1877F2";
/** Meta / Facebook blue — dark scheme primary */
export const ACCENT_DARK = "#2E89FF";

/** Soft Meta blue surfaces — light / dark */
export const ACCENT_MUTED_LIGHT = "#E7F3FF";
export const ACCENT_MUTED_DARK = "#253C5A";

/** Text / icon on blue series — light / dark */
export const ACCENT_INK_LIGHT = "#003978";
export const ACCENT_INK_DARK = "#A1CAFF";
export const ACCENT_ICON_DARK = "#88BCFF";

/** Platform system UI stack (no webfont). */
export const FONT_FAMILY_SYSTEM =
  "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif";

/**
 * OpenSeat theme: Neutral structure with Meta blue primary and system fonts.
 * Explicit accent tokens match the OpenSeat blue series; `color.accent` keeps
 * related neutrals cool-tinted from the same seed.
 */
export const openSeatTheme = defineTheme({
  name: "openseat",
  extends: neutralTheme,
  color: {
    accent: [ACCENT_LIGHT, ACCENT_DARK],
    neutralStyle: "cool",
  },
  typography: {
    body: {
      family: "system-ui",
      fallbacks:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    },
    heading: {
      family: "system-ui",
      fallbacks:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      weights: { 3: "bold", 4: "bold" },
    },
    code: {
      family: "ui-monospace",
      fallbacks: '"SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    },
  },
  tokens: {
    "--color-accent": [ACCENT_LIGHT, ACCENT_DARK],
    "--color-accent-muted": [ACCENT_MUTED_LIGHT, ACCENT_MUTED_DARK],
    "--color-on-accent": "#FFFFFF",
    "--color-text-accent": [ACCENT_INK_LIGHT, ACCENT_INK_DARK],
    "--color-icon-accent": [ACCENT_INK_LIGHT, ACCENT_ICON_DARK],
    "--font-family-body": FONT_FAMILY_SYSTEM,
    "--font-family-heading": FONT_FAMILY_SYSTEM,
  },
});
