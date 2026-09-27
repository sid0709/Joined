/**
 * Layout, text, and icon primitives from Astryx. Everything OpenSeat renders
 * sits on these, so apps never import Astryx directly.
 */
export { Stack, HStack, VStack, StackItem } from "@astryxdesign/core/Stack";
export type {
  StackProps,
  HStackProps,
  VStackProps,
  StackAlignment,
} from "@astryxdesign/core/Stack";

export { Text, Heading } from "@astryxdesign/core/Text";
export type {
  TextProps,
  TextType,
  TextColor,
  TextWeight,
  HeadingProps,
  HeadingLevel,
} from "@astryxdesign/core/Text";

export { Card } from "@astryxdesign/core/Card";
export type { CardProps, CardVariant } from "@astryxdesign/core/Card";

export { Icon } from "@astryxdesign/core/Icon";
export type { IconProps, IconName, IconSize, IconColor, IconType } from "@astryxdesign/core/Icon";

export { Tooltip } from "@astryxdesign/core/Tooltip";
export type { TooltipProps } from "@astryxdesign/core/Tooltip";
