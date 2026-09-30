import Link from "next/link";
import { formatMoney, type Balance } from "@openseat/scout";
import { ROUTES } from "@/lib/routes";

/** The scout's number one question, answered first: what can I take home. */
export function EarningsHero({
  greeting,
  balance,
  payoutReady,
  note,
}: {
  greeting: string;
  balance: Balance;
  payoutReady: boolean;
  note?: string;
}) {
  const figures = [
    { label: "On hold", value: formatMoney(balance.held) },
    { label: "Paid out", value: formatMoney(balance.paid) },
    { label: "Earned to date", value: formatMoney(balance.lifetime) },
  ];
  return (
    <section className="sw-hero" aria-label="Earnings">
      <div className="sw-hero-copy">
        <span className="sw-hero-eyebrow">{greeting}</span>
        <div className="sw-hero-figure">{formatMoney(balance.released)}</div>
        <p className="sw-hero-caption">available to pay out</p>
        {note ? <p className="sw-hero-note">{note}</p> : null}
        <div className="sw-hero-actions">
          <Link className="sw-pill" href={ROUTES.submit}>
            Submit a job
          </Link>
          <Link className="sw-hero-link" href={ROUTES.payouts}>
            {payoutReady ? "Request payout" : "Set up payouts"}
          </Link>
        </div>
      </div>
      <dl className="sw-hero-figures">
        {figures.map((figure) => (
          <div key={figure.label} className="sw-hero-figure-item">
            <dt>{figure.label}</dt>
            <dd>{figure.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
