// Original Astryx, OpenSeat-themed: primitives, actions, content, containers,
// data input, feedback, navigation, overlays, lists, and chat.
export * from "./Primitives";
export * from "./Action";
export * from "./Content";
export * from "./Container";
export * from "./DataInput";
export * from "./Feedback";
export * from "./Navigation";
export * from "./Overlay";
export * from "./Lists";
export * from "./Chat";

export type { ControlSize, FieldSize } from "./size";

export { JobCard } from "./Card";
export type { JobCardProps } from "./Card";

export { Nav } from "./Nav";
export type { NavProps, NavItem } from "./Nav";

export { TokenDemo } from "./TokenDemo";

export * from "./LayoutPrimitives";

// Responsive layer — OpenSeat composites on Astryx breakpoints.
export { GridSystem, GridColumn, GRID_COLUMNS } from "./GridSystem";
export type { GridSystemProps, GridColumnProps, GridSpanValue, Responsive } from "./GridSystem";
export {
  ResponsiveStack,
  ResponsiveContainer,
  Show,
  Hide,
  useElementWidth,
  useContainerBreakpoint,
  useViewportBreakpoint,
} from "./Responsive";
export type { ResponsiveStackProps, ResponsiveContainerProps, ShowProps } from "./Responsive";
export { ResponsiveFrame, FRAME_PRESETS } from "./ResponsiveFrame";
export type { ResponsiveFrameProps, FramePreset } from "./ResponsiveFrame";
export { Tile } from "./Tile";
export type { TileProps } from "./Tile";
export { Sticky } from "./Sticky";
export type { StickyProps } from "./Sticky";
export { TIERS, VIEWPORT_TIERS, CONTAINER_TIERS, tierFor } from "./breakpoints";
export type { Tier, TierOrBase, ResponsiveTo } from "./breakpoints";

export { Glyph, icons } from "./Glyph";
export type { GlyphName, GlyphProps } from "./Glyph";

export { Timeline } from "./Timeline";
export type {
  TimelineProps,
  TimelineItem,
  TimelineTone,
  TimelineStatus,
  TimelineVariant,
} from "./Timeline";

export { Tree } from "./Tree";
export type { TreeProps, TreeNode, TreeVariant, TreeCheckState } from "./Tree";

export { Table } from "./Table";
export type {
  TableProps,
  TableColumn,
  TableSort,
  SortDirection,
  TableVariant,
  TableSelection,
  TableDensity,
} from "./Table";

export { Clock } from "./Clock";
export type { ClockProps, ClockVariant } from "./Clock";
export { TimeField } from "./TimeField";
export type { TimeFieldProps, TimePicker } from "./TimeField";
export { TimeDial } from "./TimeDial";
export type { TimeDialProps } from "./TimeDial";
export { TimeColumns } from "./TimeColumns";
export type { TimeColumnsProps } from "./TimeColumns";
export { TimeSlots } from "./TimeSlots";
export type { TimeSlotsProps } from "./TimeSlots";
export { displayTime } from "./time";

export { Calendar } from "./Calendar";
export type {
  CalendarProps,
  CalendarEvent,
  CalendarView,
  CalendarTone,
  DateRange,
} from "./Calendar";
export { DateField } from "./DateField";
export type { DateFieldProps } from "./DateField";

// Drawer — a side or edge panel on Astryx Dialog.
export { Drawer } from "./Drawer";
export type { DrawerProps, DrawerSide, DrawerSize } from "./Drawer";

// Kanban / scrum board — drag and drop or keyboard, columns and lanes.
export { KanbanBoard } from "./KanbanBoard";
export type { KanbanBoardProps, KanbanItemState } from "./KanbanBoard";
export { moveKanbanItem, cellItems, slotOf } from "./kanban";
export type { KanbanColumn, KanbanLane, KanbanItemBase, KanbanSlot, KanbanMove } from "./kanban";

// Drag-and-drop uploads, built from Astryx parts.
export { FileUploader } from "./FileUploader";
export type { FileUploaderProps, UploadItem, UploadStatus, UploadHandler } from "./FileUploader";
export { useFileDrop, formatBytes, matchesAccept } from "./useFileDrop";
export type { UseFileDropOptions, FileDropProps } from "./useFileDrop";

export { Rating, RATING_MAX } from "./Rating";
export type { RatingProps } from "./Rating";

export { Notification, NotificationList } from "./Notification";
export type { NotificationProps, NotificationListProps, NotificationTone } from "./Notification";
export { NotificationViewport, useNotification } from "./NotificationTrigger";
export type {
  NotificationPosition,
  ShowNotificationOptions,
  NotificationDismiss,
} from "./NotificationTrigger";

// OpenSeat pickers — typed segments plus a dial, wheels, or slot list.
export { TimeInput } from "./TimeInput";
export type { TimeInputProps, TimeInputVariant, HourCycle, MinuteStep } from "./TimeInput";

export { CitySelector } from "./CitySelector";
export { LocationSelector } from "./LocationSelector";
export { StateSelector } from "./StateSelector";
export { AddressSelector } from "./AddressSelector";
export {
  US_STATES,
  US_CITIES,
  LOCATION_SEPARATOR,
  cityLabel,
  joinLocations,
  splitLocations,
  formatAddress,
  parseAddress,
  emptyAddress,
} from "./places";
export type { State, City, Address } from "./places";

export { TreeList, PageBody, PageHero, Preview, PreviewGrid } from "./Data";

// Page composites every app shares: content column, title row, section card, stats.
export { PageContainer, PageHeader, SectionCard, StatCard, StatGrid, PAGE_WIDTHS } from "./Page";
export type { PageWidth, Stat } from "./Page";

export { ThemeToggle } from "./ThemeToggle";
export type { ThemeName } from "./ThemeToggle";

// Workspace shell and dashboard pieces: pill navigation, KPI widget, segment bar.
export { PillNav } from "./PillNav";
export type { PillNavProps, PillNavItem } from "./PillNav";
export { KpiWidget } from "./Kpi";
export type { KpiDelta } from "./Kpi";
export { SegmentBar } from "./Charts";
export type { Segment, SegmentTone } from "./Charts";
export { PageTabs } from "./PageTabs";
export type { PageTab } from "./PageTabs";
