import { TopNavHeading, type TopNavHeadingProps } from "../components/LayoutPrimitives";

import { JoinedLogo } from "./JoinedLogo";
import { JoinedMark } from "./JoinedMark";
import { BRAND_NAME } from "./name";

export interface BrandHeadingProps extends Omit<
  TopNavHeadingProps,
  "logo" | "logoLabel" | "heading"
> {
  /** A product under the Joined brand (Scoutwell, Joined Admin…). Omit for Joined itself. */
  product?: string;
}

/**
 * The TopNav heading every app uses. Joined itself shows the blue wordmark; a
 * product shows the Joined app icon beside its own name.
 */
export function BrandHeading({ product, ...props }: BrandHeadingProps) {
  if (!product || product === BRAND_NAME) {
    return <TopNavHeading {...props} logo={<JoinedLogo />} logoLabel={BRAND_NAME} />;
  }
  return <TopNavHeading {...props} logo={<JoinedMark label="" />} heading={product} />;
}
