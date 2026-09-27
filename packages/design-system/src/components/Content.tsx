/**
 * Content components are original Astryx — OpenSeat only themes them.
 * Text, Heading, and Icon live in ./Primitives; import everything from
 * @openseat/design-system so apps never reach into Astryx directly.
 */
export { Avatar, AvatarStatusDot } from "@astryxdesign/core/Avatar";
export type {
  AvatarProps,
  AvatarSize,
  AvatarShape,
  AvatarStatusDotProps,
  AvatarStatusDotVariant,
} from "@astryxdesign/core/Avatar";

export { AvatarGroup, AvatarGroupOverflow } from "@astryxdesign/core/AvatarGroup";
export type { AvatarGroupProps, AvatarGroupOverflowProps } from "@astryxdesign/core/AvatarGroup";

export { Blockquote } from "@astryxdesign/core/Blockquote";
export type { BlockquoteProps } from "@astryxdesign/core/Blockquote";

export { Citation } from "@astryxdesign/core/Citation";
export type { CitationProps, CitationSource } from "@astryxdesign/core/Citation";

export { Code } from "@astryxdesign/core/Code";
export type { CodeProps, CodeColor, CodeSize } from "@astryxdesign/core/Code";

export { CodeBlock } from "@astryxdesign/core/CodeBlock";
export type { CodeBlockProps } from "@astryxdesign/core/CodeBlock";

export { EmptyState } from "@astryxdesign/core/EmptyState";
export type { EmptyStateProps } from "@astryxdesign/core/EmptyState";

export { Kbd } from "@astryxdesign/core/Kbd";
export type { KbdProps } from "@astryxdesign/core/Kbd";

export { Markdown } from "@astryxdesign/core/Markdown";
export type { MarkdownProps, MarkdownSource } from "@astryxdesign/core/Markdown";

export { Thumbnail } from "@astryxdesign/core/Thumbnail";
export type { ThumbnailProps } from "@astryxdesign/core/Thumbnail";

export { Timestamp } from "@astryxdesign/core/Timestamp";
export type {
  TimestampProps,
  TimestampFormat,
  TimestampTooltipEntry,
} from "@astryxdesign/core/Timestamp";

export { Token } from "@astryxdesign/core/Token";
export type { TokenProps, TokenColor, TokenSize } from "@astryxdesign/core/Token";
