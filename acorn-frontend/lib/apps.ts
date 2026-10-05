import type { GlyphName } from "sid-ui";

/** The browsers Acorn runs in, and how each one installs it. */

export type Availability = "available" | "soon";

export type DownloadTarget = {
  id: string;
  name: string;
  description: string;
  icon: GlyphName;
  availability: Availability;
  /** Chromium browsers install from the Chrome Web Store listing. */
  usesChromeListing: boolean;
};

export const DOWNLOADS: DownloadTarget[] = [
  {
    id: "chrome",
    name: "Acorn for Chrome",
    description: "The side panel that fills applications. Also runs in Brave and Arc.",
    icon: "download",
    availability: "available",
    usesChromeListing: true,
  },
  {
    id: "edge",
    name: "Acorn for Edge",
    description: "The same extension, installed from the Chrome Web Store in Edge.",
    icon: "download",
    availability: "available",
    usesChromeListing: true,
  },
  {
    id: "firefox",
    name: "Acorn for Firefox",
    description: "A Firefox add-on with the same side panel.",
    icon: "clock",
    availability: "soon",
    usesChromeListing: false,
  },
  {
    id: "safari",
    name: "Acorn for Safari",
    description: "A Safari web extension for macOS.",
    icon: "clock",
    availability: "soon",
    usesChromeListing: false,
  },
];
