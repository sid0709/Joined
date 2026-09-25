import type { SVGProps } from "react";

/**
 * Outline paths on a 24×24 grid, drawn to match Astryx's built-in icons
 * (1.5 stroke, round caps). Every glyph inherits `currentColor`.
 */
const PATHS = {
  chevronRight: "M9 6l6 6-6 6",
  chevronLeft: "M15 6l-6 6 6 6",
  chevronDown: "M6 9l6 6 6-6",
  chevronUp: "M6 15l6-6 6 6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  minus: "M6 12h12",
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6L6 18",
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  calendar: "M4 9h16M8 3v3M16 3v3M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  arrowUp: "M12 19V5M6 11l6-6 6 6",
  arrowDown: "M12 5v14M6 13l6 6 6-6",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  sort: "M8 9l4-4 4 4M8 15l4 4 4-4",
  folder: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  folderOpen: "M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v1M3 7v10a2 2 0 0 0 2 2h12l3.5-8H7l-4 8",
  file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  dot: "M12 12h.01",
  edit: "M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3",
  share: "M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5",
  download: "M12 3v12M7 10l5 5 5-5M5 21h14",
  upload: "M12 15V3M7 8l5-5 5 5M5 21h14",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  star: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z",
  bookmark: "M6 4h12v17l-6-4-6 4z",
  bold: "M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z",
  italic: "M10 5h8M6 19h8M14 5l-4 14",
  underline: "M7 4v7a5 5 0 0 0 10 0V4M5 20h14",
  strike: "M5 12h14M16 7a4 4 0 0 0-4-2c-2.2 0-4 1.3-4 3s1.5 2.4 4 3M8 17a4 4 0 0 0 4 2c2.2 0 4-1.3 4-3",
  alignLeft: "M4 6h16M4 10h10M4 14h16M4 18h10",
  alignCenter: "M4 6h16M7 10h10M4 14h16M7 18h10",
  alignRight: "M4 6h16M10 10h10M4 14h16M10 18h10",
  list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 21h4",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-2 1.2L14.8 21h-4l-.4-2.4a7 7 0 0 1-2-1.2l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-2.3L4.5 9.9l2-3.4 1.9.7a7 7 0 0 1 2-1.2L10.8 3h4l.3 2.4a7 7 0 0 1 2 1.2l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 2.3z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7M18 14.5a7 7 0 0 1 4 6.5",
  send: "M4 12l16-8-6 16-3-7zM11 13l9-9",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  eye: "M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7S2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  lock: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4",
  refresh: "M20 11a8 8 0 0 0-14.9-3M4 5v4h4M4 13a8 8 0 0 0 14.9 3M20 19v-4h-4",
  home: "M4 11l8-7 8 7v9H4zM10 20v-5h4v5",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  play: "M8 5v14l11-7z",
  pause: "M8 5v14M16 5v14",
  filter: "M4 5h16l-6 8v6l-4-2v-4z",
  image: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01",
  code: "M9 8l-4 4 4 4M15 8l4 4-4 4",
  undo: "M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
  redo: "M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3",
  pin: "M9 4h6l-1 6 3 3H7l3-3zM12 13v8",
  sparkle: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18",
  seat: "M7 4h10v8H7zM5 12h14v3H5zM7 15v5M17 15v5",
} as const;

export type GlyphName = keyof typeof PATHS;

export interface GlyphProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: GlyphName;
  /** Rendered size in px. Defaults to 1em so the glyph tracks the text around it. */
  size?: number | string;
}

/** Small line icons used inside design-system controls. Decorative by default. */
export function Glyph({ name, size = "1em", className, ...props }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
      className={["os-glyph", className].filter(Boolean).join(" ")}
      {...props}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

type IconComponent = ((props: SVGProps<SVGSVGElement>) => React.JSX.Element) & { displayName?: string };

/**
 * Every glyph as an Astryx `IconType`, so it drops straight into
 * `<Icon icon={icons.plus} />`, Button `icon`, menus, and toggles.
 */
export const icons = Object.fromEntries(
  (Object.keys(PATHS) as GlyphName[]).map((name) => {
    const Component: IconComponent = ({ name: _ignored, ...props }) => <Glyph {...props} name={name} />;
    Component.displayName = `Icon(${name})`;
    return [name, Component];
  })
) as Record<GlyphName, IconComponent>;
