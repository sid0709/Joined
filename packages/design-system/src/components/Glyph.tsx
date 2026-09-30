import type { SVGProps } from "react";

/**
 * Stroke icons on a 24×24 grid: round caps and joins, 2px stroke.
 * Geometry is the Lucide set (ISC) so every glyph shares one weight,
 * one optical box, and one corner treatment.
 */
type GlyphMark =
  | { d: string }
  | { cx: string; cy: string; r: string; fill?: "currentColor"; stroke?: "none" }
  | { x1: string; y1: string; x2: string; y2: string }
  | { x: string; y: string; width: string; height: string; rx?: string; ry?: string };

const MARKS = {
  chevronRight: [{ d: "m9 18 6-6-6-6" }],
  chevronLeft: [{ d: "m15 18-6-6 6-6" }],
  chevronDown: [{ d: "m6 9 6 6 6-6" }],
  chevronUp: [{ d: "m18 15-6-6-6 6" }],
  check: [{ d: "M20 6 9 17l-5-5" }],
  minus: [{ d: "M5 12h14" }],
  plus: [{ d: "M5 12h14" }, { d: "M12 5v14" }],
  close: [{ d: "M18 6 6 18" }, { d: "m6 6 12 12" }],
  clock: [{ cx: "12", cy: "12", r: "10" }, { d: "M12 6v6l4 2" }],
  calendar: [
    { d: "M8 2v3" },
    { d: "M16 2v3" },
    { x: "3", y: "3", width: "18", height: "18", rx: "2" },
    { d: "M3 9h18" },
  ],
  arrowUp: [{ d: "m5 12 7-7 7 7" }, { d: "M12 19V5" }],
  arrowDown: [{ d: "M12 5v14" }, { d: "m19 12-7 7-7-7" }],
  arrowRight: [{ d: "M5 12h14" }, { d: "m12 5 7 7-7 7" }],
  arrowLeft: [{ d: "m12 19-7-7 7-7" }, { d: "M19 12H5" }],
  sort: [{ d: "m7 15 5 5 5-5" }, { d: "m7 9 5-5 5 5" }],
  folder: [
    {
      d: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z",
    },
  ],
  folderOpen: [
    {
      d: "m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2",
    },
  ],
  file: [
    {
      d: "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",
    },
    { d: "M14 2v5a1 1 0 0 0 1 1h5" },
  ],
  search: [{ d: "m21 21-4.34-4.34" }, { cx: "11", cy: "11", r: "8" }],
  dot: [{ cx: "12", cy: "12", r: "1.25", fill: "currentColor", stroke: "none" }],
  edit: [
    {
      d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",
    },
    { d: "m15 5 4 4" },
  ],
  trash: [
    { d: "M10 11v6" },
    { d: "M14 11v6" },
    { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" },
    { d: "M3 6h18" },
    { d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" },
  ],
  share: [
    { d: "M12 2v13" },
    { d: "m16 6-4-4-4 4" },
    { d: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" },
  ],
  download: [
    { d: "M12 15V3" },
    { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" },
    { d: "m7 10 5 5 5-5" },
  ],
  upload: [
    { d: "M12 3v12" },
    { d: "m17 8-5-5-5 5" },
    { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" },
  ],
  heart: [
    {
      d: "M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5",
    },
  ],
  star: [
    {
      d: "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",
    },
  ],
  bookmark: [
    {
      d: "M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z",
    },
  ],
  bold: [{ d: "M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" }],
  italic: [
    { x1: "19", y1: "4", x2: "10", y2: "4" },
    { x1: "14", y1: "20", x2: "5", y2: "20" },
    { x1: "15", y1: "4", x2: "9", y2: "20" },
  ],
  underline: [{ d: "M6 4v6a6 6 0 0 0 12 0V4" }, { x1: "4", y1: "20", x2: "20", y2: "20" }],
  strike: [
    { d: "M16 4H9a3 3 0 0 0-2.83 4" },
    { d: "M14 12a4 4 0 0 1 0 8H6" },
    { x1: "4", y1: "12", x2: "20", y2: "12" },
  ],
  alignLeft: [{ d: "M21 5H3" }, { d: "M15 12H3" }, { d: "M17 19H3" }],
  alignCenter: [{ d: "M21 5H3" }, { d: "M17 12H7" }, { d: "M19 19H5" }],
  alignRight: [{ d: "M21 5H3" }, { d: "M21 12H9" }, { d: "M21 19H7" }],
  list: [
    { d: "M3 5h.01" },
    { d: "M3 12h.01" },
    { d: "M3 19h.01" },
    { d: "M8 5h13" },
    { d: "M8 12h13" },
    { d: "M8 19h13" },
  ],
  grid: [
    { x: "3", y: "3", width: "7", height: "7", rx: "1" },
    { x: "14", y: "3", width: "7", height: "7", rx: "1" },
    { x: "14", y: "14", width: "7", height: "7", rx: "1" },
    { x: "3", y: "14", width: "7", height: "7", rx: "1" },
  ],
  bell: [
    { d: "M10.268 21a2 2 0 0 0 3.464 0" },
    {
      d: "M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326",
    },
  ],
  settings: [
    {
      d: "M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915",
    },
    { cx: "12", cy: "12", r: "3" },
  ],
  user: [{ d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" }, { cx: "12", cy: "7", r: "4" }],
  users: [
    { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" },
    { d: "M16 3.128a4 4 0 0 1 0 7.744" },
    { d: "M22 21v-2a4 4 0 0 0-3-3.87" },
    { cx: "9", cy: "7", r: "4" },
  ],
  send: [
    {
      d: "M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z",
    },
    { d: "m21.854 2.147-10.94 10.939" },
  ],
  link: [
    { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" },
    { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" },
  ],
  eye: [
    {
      d: "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",
    },
    { cx: "12", cy: "12", r: "3" },
  ],
  lock: [
    { x: "3", y: "11", width: "18", height: "11", rx: "2", ry: "2" },
    { d: "M7 11V7a5 5 0 0 1 10 0v4" },
  ],
  refresh: [
    { d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" },
    { d: "M21 3v5h-5" },
    { d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" },
    { d: "M8 16H3v5" },
  ],
  home: [
    { d: "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" },
    {
      d: "M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
    },
  ],
  mail: [
    { d: "m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" },
    { x: "2", y: "4", width: "20", height: "16", rx: "2" },
  ],
  play: [
    { d: "M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" },
  ],
  pause: [
    { x: "14", y: "3", width: "5", height: "18", rx: "1" },
    { x: "5", y: "3", width: "5", height: "18", rx: "1" },
  ],
  filter: [
    {
      d: "M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z",
    },
  ],
  image: [
    { x: "3", y: "3", width: "18", height: "18", rx: "2", ry: "2" },
    { cx: "9", cy: "9", r: "2" },
    { d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" },
  ],
  code: [{ d: "m16 18 6-6-6-6" }, { d: "m8 6-6 6 6 6" }],
  undo: [{ d: "M9 14 4 9l5-5" }, { d: "M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" }],
  redo: [{ d: "m15 14 5-5-5-5" }, { d: "M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13" }],
  pin: [
    { d: "M12 17v5" },
    {
      d: "M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z",
    },
  ],
  sparkle: [
    {
      d: "M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z",
    },
    { d: "M20 2v4" },
    { d: "M22 4h-4" },
    { cx: "4", cy: "20", r: "2" },
  ],
  seat: [
    { d: "M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3" },
    {
      d: "M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z",
    },
    { d: "M5 18v2" },
    { d: "M19 18v2" },
  ],
  chat: [
    {
      d: "M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z",
    },
  ],
  info: [{ cx: "12", cy: "12", r: "10" }, { d: "M12 16v-4" }, { d: "M12 8h.01" }],
  panelRight: [{ x: "3", y: "3", width: "18", height: "18", rx: "2" }, { d: "M15 3v18" }],
  archive: [
    { x: "2", y: "3", width: "20", height: "5", rx: "1" },
    { d: "M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" },
    { d: "M10 12h4" },
  ],
  signOut: [
    { d: "m16 17 5-5-5-5" },
    { d: "M21 12H9" },
    { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" },
  ],
  sun: [
    { cx: "12", cy: "12", r: "4" },
    { d: "M12 2v2" },
    { d: "M12 20v2" },
    { d: "m4.93 4.93 1.41 1.41" },
    { d: "m17.66 17.66 1.41 1.41" },
    { d: "M2 12h2" },
    { d: "M20 12h2" },
    { d: "m6.34 17.66-1.41 1.41" },
    { d: "m19.07 4.93-1.41 1.41" },
  ],
  moon: [
    {
      d: "M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401",
    },
  ],
} satisfies Record<string, readonly GlyphMark[]>;

export type GlyphName = keyof typeof MARKS;

export interface GlyphProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: GlyphName;
  /** Rendered size in px. Defaults to 1em so the glyph tracks the text around it. */
  size?: number | string;
}

function Mark({ mark }: { mark: GlyphMark }) {
  if ("d" in mark) return <path d={mark.d} />;
  if ("x1" in mark) return <line x1={mark.x1} y1={mark.y1} x2={mark.x2} y2={mark.y2} />;
  if ("width" in mark) {
    return (
      <rect
        x={mark.x}
        y={mark.y}
        width={mark.width}
        height={mark.height}
        rx={mark.rx}
        ry={mark.ry}
      />
    );
  }
  return <circle cx={mark.cx} cy={mark.cy} r={mark.r} fill={mark.fill} stroke={mark.stroke} />;
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
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
      className={["os-glyph", className].filter(Boolean).join(" ")}
      {...props}
    >
      {MARKS[name].map((mark, index) => (
        <Mark key={index} mark={mark} />
      ))}
    </svg>
  );
}

type IconComponent = ((props: SVGProps<SVGSVGElement>) => React.JSX.Element) & {
  displayName?: string;
};

/**
 * Every glyph as an Astryx `IconType`, so it drops straight into
 * `<Icon icon={icons.plus} />`, Button `icon`, menus, and toggles.
 */
export const icons = Object.fromEntries(
  (Object.keys(MARKS) as GlyphName[]).map((name) => {
    const Component: IconComponent = ({ name: _ignored, ...props }) => (
      <Glyph {...props} name={name} />
    );
    Component.displayName = `Icon(${name})`;
    return [name, Component];
  }),
) as Record<GlyphName, IconComponent>;
