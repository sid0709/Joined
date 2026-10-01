import { JoinedLogo } from "./JoinedLogo";
import { JoinedMark } from "./JoinedMark";
import { BRAND_NAME } from "./name";

/** Rendered heights, so the icon and wordmark keep one proportion everywhere. */
const ICON_SIZE = "3rem";
const WORDMARK_HEIGHT = "2.5rem";
const ENDORSEMENT_HEIGHT = "0.875rem";

export interface BrandLockupProps {
  /** A product under the Joined brand. Omit for Joined itself. */
  product?: string;
  /** One line under the logo: what this place is for. */
  tagline?: string;
  align?: "center" | "start";
  className?: string;
}

/**
 * The logo block that opens sign-in, sign-up, onboarding, and error pages.
 * Joined shows its wordmark; a product shows the app icon, its name, and "by Joined".
 */
export function BrandLockup({ product, tagline, align = "center", className }: BrandLockupProps) {
  const classes = ["os-brand-lockup", align === "start" && "os-brand-lockup-start", className]
    .filter(Boolean)
    .join(" ");
  const isProduct = Boolean(product) && product !== BRAND_NAME;

  return (
    <div className={classes}>
      {isProduct ? (
        <>
          <div className="os-brand-lockup-row">
            <JoinedMark size={ICON_SIZE} label="" />
            <p className="os-brand-lockup-product">{product}</p>
          </div>
          <span className="os-brand-lockup-endorse">
            by <JoinedLogo height={ENDORSEMENT_HEIGHT} />
          </span>
        </>
      ) : (
        <JoinedLogo height={WORDMARK_HEIGHT} />
      )}
      {tagline && <p className="os-brand-lockup-tagline">{tagline}</p>}
    </div>
  );
}
