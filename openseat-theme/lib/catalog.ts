import type { IconName } from "@openseat/design-system";

export type CatalogItem = {
  slug: string;
  title: string;
  description: string;
  importName: string;
};

export type CatalogGroup = {
  category: string;
  icon: IconName;
  items: CatalogItem[];
};

export const CATALOG: CatalogGroup[] = [
  {
    category: "Foundations",
    icon: "wrench",
    items: [
      {
        slug: "tokens",
        title: "Tokens",
        description: "OpenSeat theme primitives — Meta blue accent, system fonts, space, radius.",
        importName: "tokens",
      },
    ],
  },
  {
    category: "Action",
    icon: "check",
    items: [
      {
        slug: "button",
        title: "Button",
        description: "Primary, outline, and pill. Sizes are sm, md, and lg.",
        importName: "Button",
      },
      {
        slug: "button-group",
        title: "Button Group",
        description: "Joined actions, including a fully round pill group.",
        importName: "ButtonGroup",
      },
      {
        slug: "icon-button",
        title: "Icon Button",
        description: "Icon-only actions, including a circular pill.",
        importName: "IconButton",
      },
      {
        slug: "link",
        title: "Link",
        description: "Navigation, never an action.",
        importName: "Link",
      },
      {
        slug: "dropdown-menu",
        title: "Dropdown Menu",
        description: "A trigger-anchored list of actions.",
        importName: "DropdownMenu",
      },
      {
        slug: "more-menu",
        title: "More Menu",
        description: "The overflow trigger variant of Menu.",
        importName: "MoreMenu",
      },
      {
        slug: "segmented-control",
        title: "Segmented Control",
        description: "A closed set of mutually exclusive views.",
        importName: "SegmentedControl",
      },
      {
        slug: "toggle-button",
        title: "Toggle Button",
        description: "A binary on/off control shaped like a Button.",
        importName: "ToggleButton",
      },
      {
        slug: "toggle-button-group",
        title: "Toggle Button Group",
        description: "Independent toggles that share one group.",
        importName: "ToggleButtonGroup",
      },
      {
        slug: "toolbar",
        title: "Toolbar",
        description: "A row of related controls.",
        importName: "Toolbar",
      },
    ],
  },
  {
    category: "Layout",
    icon: "viewColumns",
    items: [
      {
        slug: "app-shell",
        title: "App Shell",
        description:
          "The product frame — top nav, side nav, and a content area that turns into a mobile drawer by breakpoint.",
        importName: "AppShell",
      },
      {
        slug: "aspect-ratio",
        title: "Aspect Ratio",
        description: "Keeps media at a fixed shape at any width — covers, heroes, avatars.",
        importName: "AspectRatio",
      },
      {
        slug: "divider",
        title: "Divider",
        description: "Subtle or strong rules, with labels, vertical, and full-bleed.",
        importName: "Divider",
      },
      {
        slug: "form-layout",
        title: "Form Layout",
        description: "Field spacing and rows, plus responsive one- to two-column forms.",
        importName: "FormLayout",
      },
      {
        slug: "grid",
        title: "Grid",
        description:
          "A responsive 12-track grid — spans, order, and visibility per tier — plus Astryx’s intrinsic Grid.",
        importName: "GridSystem",
      },
      {
        slug: "layout",
        title: "Layout",
        description: "Header, footer, start and end panels around scrolling content.",
        importName: "Layout",
      },
      {
        slug: "section",
        title: "Section",
        description: "Surfaces, padding, and dividers for grouping content.",
        importName: "Section",
      },
      {
        slug: "stack",
        title: "Stack",
        description:
          "Gapped rows and columns, plus ResponsiveStack that turns a column into a row by tier.",
        importName: "Stack",
      },
      {
        slug: "resize-handle",
        title: "Resize Handle",
        description: "Drag to size panes — pixels or percent, collapsible, with snap points.",
        importName: "ResizeHandle",
      },
      {
        slug: "scrollable-area",
        title: "Scrollable Area",
        description: "Contained scrolling on one or both axes, for lists, rails, and wide tables.",
        importName: "ScrollableArea",
      },
    ],
  },
  {
    category: "Content",
    icon: "copy",
    items: [
      {
        slug: "avatar",
        title: "Avatar",
        description:
          "A person as an image, initials, or glyph — sizes, shapes, status dots, links, and stacked groups.",
        importName: "Avatar",
      },
      {
        slug: "blockquote",
        title: "Blockquote",
        description:
          "A quoted passage with an optional rich attribution — articles, release notes, testimonials.",
        importName: "Blockquote",
      },
      {
        slug: "citation",
        title: "Citation",
        description:
          "A source chip as a label or a number, inline in copy or paired with a footnote list.",
        importName: "Citation",
      },
      {
        slug: "code",
        title: "Code",
        description:
          "Inline monospace for props, paths, and commands — in copy, headings, and links.",
        importName: "Code",
      },
      {
        slug: "code-block",
        title: "Code Block",
        description:
          "Highlighted samples with titles, line numbers, highlights, copy, wrapping, and collapsing.",
        importName: "CodeBlock",
      },
      {
        slug: "empty-state",
        title: "Empty State",
        description:
          "Says what will fill this space — icons, actions, search misses, errors, and compact panels.",
        importName: "EmptyState",
      },
      {
        slug: "heading",
        title: "Heading",
        description:
          "h1–h6 plus display types, with outline-only levels, truncation, and balanced wrapping.",
        importName: "Heading",
      },
      {
        slug: "icon",
        title: "Icon",
        description:
          "The Astryx registry and the OpenSeat set — sizes, semantic and palette colors, and labels.",
        importName: "Icon",
      },
      {
        slug: "kbd",
        title: "Kbd",
        description:
          "Platform-aware shortcuts — special keys, combinations, buttons, and shortcut sheets.",
        importName: "Kbd",
      },
      {
        slug: "markdown",
        title: "Markdown",
        description:
          "Documents, code, tables, links, citations, compact density, and streaming answers.",
        importName: "Markdown",
      },
      {
        slug: "text",
        title: "Text",
        description:
          "Body copy from the type scale — types, sizes, weights, colors, truncation, and wrapping.",
        importName: "Text",
      },
      {
        slug: "thumbnail",
        title: "Thumbnail",
        description: "An image preview that loads, fails, removes, opens, and uploads.",
        importName: "Thumbnail",
      },
      {
        slug: "timestamp",
        title: "Timestamp",
        description:
          "Every relative and absolute format, live updates, time zones, and a copyable hover card.",
        importName: "Timestamp",
      },
      {
        slug: "token",
        title: "Token",
        description:
          "A tag or filter chip — sizes, colors, icons, removable, clickable, and linked.",
        importName: "Token",
      },
    ],
  },
  {
    category: "Container",
    icon: "menu",
    items: [
      {
        slug: "card",
        title: "Card",
        description:
          "Variants, elevation, and padding — plus clickable, selectable, stat, profile, and room cards.",
        importName: "Card",
      },
      {
        slug: "carousel",
        title: "Carousel",
        description:
          "Scrolling rails with snap, loop, and edge fade — rooms, testimonials, attachments, and guided steps.",
        importName: "Carousel",
      },
      {
        slug: "collapsible",
        title: "Collapsible",
        description:
          "Disclosures and accordions — controlled, grouped, dense or roomy, with rich triggers.",
        importName: "Collapsible",
      },
    ],
  },
  {
    category: "Data input",
    icon: "search",
    items: [
      {
        slug: "calendar",
        title: "Calendar",
        description: "A month grid or a weekly schedule, at sm, md, and lg.",
        importName: "Calendar",
      },
      {
        slug: "checkbox",
        title: "Checkbox",
        description: "Single boxes, select-all, validation, async saves, and checkbox lists.",
        importName: "CheckboxInput",
      },
      {
        slug: "date-input",
        title: "Date Input",
        description:
          "Dates, ranges with presets, and date-times — formats, limits, and blocked days.",
        importName: "DateInput",
      },
      {
        slug: "field",
        title: "Field",
        description: "Label, description, and status for any control — including your own.",
        importName: "Field",
      },
      {
        slug: "file-input",
        title: "File Input",
        description: "Drop zones and compact inputs — many files, size limits, and uploads.",
        importName: "FileInput",
      },
      {
        slug: "number-input",
        title: "Number Input",
        description: "Steppers, units, currency formatting, limits, and a live bid calculator.",
        importName: "NumberInput",
      },
      {
        slug: "radio",
        title: "Radio",
        description: "One choice from a list — descriptions, icons, prices, and horizontal rows.",
        importName: "RadioList",
      },
      {
        slug: "select",
        title: "Selector",
        description: "Single and multi select — sections, search, avatars, and ghost menus.",
        importName: "Selector",
      },
      {
        slug: "rating",
        title: "Rating",
        description: "A star score, from read-only to a ten-mark scale.",
        importName: "Rating",
      },
      {
        slug: "slider",
        title: "Slider",
        description: "Single values and ranges — marks, value display, vertical, and live filters.",
        importName: "Slider",
      },
      {
        slug: "switch",
        title: "Switch",
        description:
          "Instant settings — spread rows, async saves, rollbacks, and dependent toggles.",
        importName: "Switch",
      },
      {
        slug: "text-area",
        title: "Text Area",
        description: "Multi-line text — limits, guided status, autosave, and a reply composer.",
        importName: "TextArea",
      },
      {
        slug: "text-input",
        title: "Text Input",
        description: "Types, sizes, status, async checks, input groups, and a sign-in form.",
        importName: "TextInput",
      },
      {
        slug: "time-input",
        title: "Time Input",
        description: "A clock face — 12-hour, 24-hour, steps, and sm to lg.",
        importName: "TimeInput",
      },
      {
        slug: "tokenizer",
        title: "Tokenizer",
        description: "Pick many from a search — people, tags, limits, overflow, and invites.",
        importName: "Tokenizer",
      },
      {
        slug: "typeahead",
        title: "Typeahead",
        description: "Pick one from a search — static and async sources, custom rows.",
        importName: "Typeahead",
      },
    ],
  },
  {
    category: "Feedback & status",
    icon: "info",
    items: [
      {
        slug: "badge",
        title: "Badge",
        description: "Status and category labels — icons, counts, lifecycles, and list rows.",
        importName: "Badge",
      },
      {
        slug: "banner",
        title: "Banner",
        description: "Page and section messages — dismissable, actionable, collapsible, elevated.",
        importName: "Banner",
      },
      {
        slug: "notification",
        title: "Notification",
        description: "An inbox row, plus useNotification to show a message at any corner.",
        importName: "Notification",
      },
      {
        slug: "progress-bar",
        title: "Progress Bar",
        description: "Values, variants, milestones, live uploads, and quota thresholds.",
        importName: "ProgressBar",
      },
      {
        slug: "skeleton",
        title: "Skeleton",
        description: "Loading shapes that match real layouts — cards, rows, and articles.",
        importName: "Skeleton",
      },
      {
        slug: "spinner",
        title: "Spinner",
        description: "Indeterminate waits — sizes, shades, labels, and loading regions.",
        importName: "Spinner",
      },
      {
        slug: "status-dot",
        title: "Status Dot",
        description: "Labeled dots for presence, services, and legends — pulsing when live.",
        importName: "StatusDot",
      },
      {
        slug: "toast",
        title: "Toast",
        description: "useToast — actions, timing, de-duplication, positions, and dismiss control.",
        importName: "Toast",
      },
    ],
  },
  {
    category: "Navigation",
    icon: "chevronRight",
    items: [
      {
        slug: "breadcrumbs",
        title: "Breadcrumbs",
        description: "Paths with icons, sibling menus, deep collapsing, and client navigation.",
        importName: "Breadcrumbs",
      },
      {
        slug: "pagination",
        title: "Pagination",
        description: "Pages, count, compact, input, and dots — page sizes and unknown totals.",
        importName: "Pagination",
      },
      {
        slug: "side-nav",
        title: "Side Nav",
        description: "Sections, nesting, a collapsible rail, pinned items, and a footer.",
        importName: "SideNav",
      },
      {
        slug: "stepper",
        title: "Stepper",
        description: "Horizontal and vertical steps — status, optional, collapsing, and a wizard.",
        importName: "Stepper",
      },
      {
        slug: "tab-list",
        title: "Tab List",
        description: "Icons, counts, fill, overflow, tab menus, and full-bleed panels.",
        importName: "TabList",
      },
      {
        slug: "top-nav",
        title: "Top Nav",
        description: "Product bars with search, menus, mega menus, and the OpenSeat Nav.",
        importName: "TopNav",
      },
    ],
  },
  {
    category: "Overlay",
    icon: "moreHorizontal",
    items: [
      {
        slug: "bottom-sheet",
        title: "Bottom Sheet",
        description: "Heights, action sheets, snap points, filters, and switching sheets.",
        importName: "BottomSheet",
      },
      {
        slug: "command-palette",
        title: "Command Palette",
        description: "⌘K actions with shortcuts, a people finder, and an inline palette.",
        importName: "CommandPalette",
      },
      {
        slug: "context-menu",
        title: "Context Menu",
        description: "Right-click menus with icons, submenus, sections, and destructive actions.",
        importName: "ContextMenu",
      },
      {
        slug: "dialog",
        title: "Dialog",
        description: "Confirm, alert, form, info, fullscreen, and imperative dialogs.",
        importName: "Dialog",
      },
      {
        slug: "drawer",
        title: "Drawer",
        description:
          "Edge panels for details, edits, and filters — any side, any size, with sticky actions.",
        importName: "Drawer",
      },
      {
        slug: "hover-card",
        title: "Hover Card",
        description: "Rich previews for people and rooms — placement and delays.",
        importName: "HoverCard",
      },
      {
        slug: "popover",
        title: "Popover",
        description: "Filter panels, controlled forms, profile menus, and info popovers.",
        importName: "Popover",
      },
      {
        slug: "tooltip",
        title: "Tooltip",
        description: "Labels, shortcuts, placement, delays, truncation, and disabled controls.",
        importName: "Tooltip",
      },
    ],
  },
  {
    category: "Table & list",
    icon: "viewColumns",
    items: [
      {
        slug: "kanban",
        title: "Kanban Board",
        description:
          "Jira-style boards — drag cards across columns and swimlanes, WIP limits, keyboard moves.",
        importName: "KanbanBoard",
      },
      {
        slug: "list",
        title: "List",
        description:
          "Markers, density, rich rows, selection, links, checklists, and notifications.",
        importName: "List",
      },
      {
        slug: "metadata-list",
        title: "Metadata List",
        description: "Label and value pairs — top or start labels, columns, icons, and show more.",
        importName: "MetadataList",
      },
      {
        slug: "overflow-list",
        title: "Overflow List",
        description: "Fits what it can and counts the rest — badges, tokens, avatars, and actions.",
        importName: "OverflowList",
      },
      {
        slug: "table",
        title: "Table",
        description: "Rows you can stripe, tighten, select, or leave empty.",
        importName: "Table",
      },
      {
        slug: "timeline",
        title: "Timeline",
        description: "Events on a rail, in cards, alternating, or across.",
        importName: "Timeline",
      },
      {
        slug: "tree-list",
        title: "Tree",
        description: "A hierarchy you can filter, select, and restyle.",
        importName: "Tree",
      },
    ],
  },
  {
    category: "Chat",
    icon: "microphone",
    items: [
      {
        slug: "chat",
        title: "Chat",
        description: "Threads, an assistant with tool calls and streaming, and a full composer.",
        importName: "ChatLayout",
      },
    ],
  },
  {
    category: "Utility",
    icon: "eyeSlash",
    items: [
      {
        slug: "visually-hidden",
        title: "Visually Hidden",
        description: "Content for assistive tech only.",
        importName: "VisuallyHidden",
      },
    ],
  },
];

export const ALL_ITEMS = CATALOG.flatMap((g) => g.items);

export const COMPONENT_ITEMS = ALL_ITEMS.filter((item) => item.slug !== "tokens");

export function findItem(slug: string) {
  return ALL_ITEMS.find((i) => i.slug === slug);
}

export function itemHref(slug: string) {
  return slug === "tokens" ? "/tokens" : `/components/${slug}`;
}
