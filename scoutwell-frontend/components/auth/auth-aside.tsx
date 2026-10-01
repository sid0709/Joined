import { JoinedLogo, JoinedMark } from "@joined/design-system";
import { BRAND } from "@/lib/config";

const POINTS = [
  "Submit official openings from company careers pages",
  "Automatic checks in seconds, not days",
  "Earn on interviews and hires, never on volume",
];

/** The brand panel beside the sign-in and sign-up forms, on wide screens. */
export function AuthAside() {
  return (
    <aside className="sw-auth-aside" aria-label={BRAND}>
      <span className="sw-auth-brand">
        <JoinedMark size="2.5rem" label="" />
        <span className="sw-eyebrow sw-eyebrow-on-dark">{BRAND}</span>
      </span>
      <p className="sw-auth-quote">The jobs the big boards miss, found by you.</p>
      <ul className="sw-auth-points">
        {POINTS.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <span className="sw-auth-endorse">
        Part of <JoinedLogo variant="white" height="1rem" />
      </span>
    </aside>
  );
}
