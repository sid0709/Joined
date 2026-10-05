import { Button, Glyph } from "sid-ui";

/**
 * Opens a public page — a job posting, the company page — the way candidates
 * see it, in a new tab so the hiring workspace stays where you left it.
 */
export function CandidateViewButton({ href, label }: { href: string; label: string }) {
  return (
    <Button
      label={label}
      variant="secondary"
      href={href}
      target="_blank"
      rel="noopener"
      icon={<Glyph name="eye" />}
    />
  );
}
