import { formatMoney, type Meta } from "@openseat/scout";

/** Four numbered steps, from link to payout. */
export function HowItWorks({ meta }: { meta: Meta }) {
  const steps = [
    {
      title: "Find an opening",
      body: "On a company careers page or its ATS: Greenhouse, Lever, Ashby, Workday, and more.",
    },
    {
      title: "Submit the official link",
      body: "Company, title, and a job description in your own words.",
    },
    {
      title: "We check it in seconds",
      body: "Reachable, official, still open, not a duplicate, not a scam.",
    },
    {
      title: "Earn when it's used",
      body: `Interviews and hires pay you. Rewards hold ${meta.rewards.hold_days} days; payouts from ${formatMoney(meta.rewards.min_payout)}.`,
    },
  ];

  return (
    <section className="sw-section" aria-labelledby="sw-how">
      <div className="sw-section-head">
        <span className="sw-eyebrow">How it works</span>
        <h2 id="sw-how" className="sw-section-title">
          From link to payout.
        </h2>
      </div>
      <ol className="sw-steps">
        {steps.map((step) => (
          <li key={step.title} className="sw-step">
            <h3 className="sw-step-title">{step.title}</h3>
            <p className="sw-step-body">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
