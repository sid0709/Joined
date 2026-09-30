import { Button } from "@openseat/design-system";
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
          <Button label="Submit a job" variant="primary" size="lg" href={ROUTES.submit} />
          <Button
            label={payoutReady ? "Request payout" : "Set up payouts"}
            variant="ghost"
            size="lg"
            href={ROUTES.payouts}
          />
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
