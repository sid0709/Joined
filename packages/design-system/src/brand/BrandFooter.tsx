import { JoinedLogo } from "./JoinedLogo";
import { JoinedMark } from "./JoinedMark";

const MARK_SIZE = "1rem";
const WORDMARK_HEIGHT = "0.875rem";

export interface BrandFooterProps {
  /** Words before the wordmark. */
  lead?: string;
  /** Where the wordmark links, e.g. the Joined home page. Plain text when omitted. */
  href?: string;
  align?: "center" | "start";
  className?: string;
}

/** A quiet sign-off under landing, auth, and error pages: the symbol, a lead, and the wordmark. */
export function BrandFooter({
  lead = "Part of",
  href,
  align = "center",
  className,
}: BrandFooterProps) {
  const classes = ["os-brand-footer", align === "start" && "os-brand-footer-start", className]
    .filter(Boolean)
    .join(" ");
  const signOff = (
    <>
      <JoinedMark variant="blue" size={MARK_SIZE} label="" />
      <span>{lead}</span>
      <JoinedLogo height={WORDMARK_HEIGHT} />
    </>
  );

  return (
    <footer className={classes}>
      {href ? (
        <a className="os-brand-footer-link" href={href}>
          {signOff}
        </a>
      ) : (
        <span className="os-brand-footer-link">{signOff}</span>
      )}
    </footer>
  );
}
