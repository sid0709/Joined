import type { GlyphName } from "@joined/design-system";

/** Where Acorn runs, and the plugins that extend what it fills and where it reports. */

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

export type PluginCategory = "autofill" | "integration";

export type Plugin = {
  id: string;
  name: string;
  description: string;
  category: PluginCategory;
  icon: GlyphName;
  availability: Availability;
  /** On until you turn it off. */
  isDefaultOn: boolean;
};

export const PLUGINS: Plugin[] = [
  {
    id: "greenhouse",
    name: "Greenhouse",
    description: "Fills Greenhouse forms, including custom questions and EEO pages.",
    category: "autofill",
    icon: "edit",
    availability: "available",
    isDefaultOn: true,
  },
  {
    id: "lever",
    name: "Lever",
    description: "Fills Lever applications and attaches your default résumé.",
    category: "autofill",
    icon: "edit",
    availability: "available",
    isDefaultOn: true,
  },
  {
    id: "workday",
    name: "Workday",
    description: "Signs in or creates the account, then walks every Workday step.",
    category: "autofill",
    icon: "edit",
    availability: "available",
    isDefaultOn: true,
  },
  {
    id: "ashby",
    name: "Ashby",
    description: "Fills Ashby-hosted job forms.",
    category: "autofill",
    icon: "edit",
    availability: "available",
    isDefaultOn: true,
  },
  {
    id: "linkedin",
    name: "LinkedIn Easy Apply",
    description: "Answers Easy Apply questions from your profile.",
    category: "autofill",
    icon: "edit",
    availability: "available",
    isDefaultOn: false,
  },
  {
    id: "icims",
    name: "iCIMS",
    description: "Fills iCIMS career portals.",
    category: "autofill",
    icon: "edit",
    availability: "soon",
    isDefaultOn: false,
  },
  {
    id: "calendar",
    name: "Google Calendar",
    description: "Adds interviews from Gmail to your calendar.",
    category: "integration",
    icon: "calendar",
    availability: "soon",
    isDefaultOn: false,
  },
  {
    id: "slack",
    name: "Slack",
    description: "Posts recruiter replies to a channel or DM.",
    category: "integration",
    icon: "chat",
    availability: "soon",
    isDefaultOn: false,
  },
  {
    id: "sheets",
    name: "Google Sheets",
    description: "Keeps a spreadsheet of every application and its status.",
    category: "integration",
    icon: "grid",
    availability: "soon",
    isDefaultOn: false,
  },
  {
    id: "notion",
    name: "Notion",
    description: "Syncs applications to a Notion database.",
    category: "integration",
    icon: "list",
    availability: "soon",
    isDefaultOn: false,
  },
];

export function isPluginOn(plugin: Plugin, settings: Record<string, boolean>) {
  if (plugin.availability !== "available") return false;
  return settings[plugin.id] ?? plugin.isDefaultOn;
}
