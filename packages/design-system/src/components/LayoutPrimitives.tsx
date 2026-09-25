/**
 * Layout and navigation frames are original Astryx. OpenSeat adds the
 * responsive layer on top (GridSystem, ResponsiveStack, Show/Hide, ResponsiveFrame).
 */
export { AppShell, useAppShellMobile } from "@astryxdesign/core/AppShell";
export type { AppShellProps, AppShellVariant, AppShellBreakpoint, MobileNavConfig } from "@astryxdesign/core/AppShell";

export { AspectRatio } from "@astryxdesign/core/AspectRatio";
export type { AspectRatioProps, AspectRatioShape, AspectRatioFit } from "@astryxdesign/core/AspectRatio";

export { Center } from "@astryxdesign/core/Center";
export type { CenterProps, CenterAxis } from "@astryxdesign/core/Center";

export { Divider } from "@astryxdesign/core/Divider";
export type { DividerProps, DividerVariant } from "@astryxdesign/core/Divider";

export { FormLayout } from "@astryxdesign/core/FormLayout";
export type { FormLayoutProps, FormLayoutDirection, FormOptionality } from "@astryxdesign/core/FormLayout";

export { Grid, GridSpan } from "@astryxdesign/core/Grid";
export type { GridProps, GridColumns, GridAlignment, GridSpanProps } from "@astryxdesign/core/Grid";

export { Layout, LayoutHeader, LayoutContent, LayoutFooter, LayoutPanel } from "@astryxdesign/core/Layout";
export type { LayoutProps, LayoutHeight, LayoutHeaderProps, LayoutContentProps, LayoutFooterProps, LayoutPanelProps } from "@astryxdesign/core/Layout";

export { Section } from "@astryxdesign/core/Section";
export type { SectionProps, SectionVariant } from "@astryxdesign/core/Section";

export { ScrollableArea } from "@astryxdesign/core/ScrollableArea";
export type { ScrollableAreaProps } from "@astryxdesign/core/ScrollableArea";

export { ResizeHandle, useResizable, percent } from "@astryxdesign/core/Resizable";
export type { ResizeHandleProps, ResizableRegion, ResizableProps } from "@astryxdesign/core/Resizable";

export { TopNav, TopNavHeading, TopNavItem, TopNavMenu } from "@astryxdesign/core/TopNav";
export type { TopNavProps, TopNavHeadingProps, TopNavItemProps, TopNavMenuProps } from "@astryxdesign/core/TopNav";

export { SideNav, SideNavHeading, SideNavItem, SideNavSection, SideNavCollapseButton } from "@astryxdesign/core/SideNav";
export type { SideNavProps, SideNavItemProps, SideNavSectionProps } from "@astryxdesign/core/SideNav";

export { useMediaQuery } from "@astryxdesign/core/hooks";
