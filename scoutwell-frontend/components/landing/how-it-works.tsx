import { type Meta } from "@joined/scout";
import { earnFigures } from "@/lib/site-copy";

/** Four numbered steps, from install to payout. */
export function HowItWorks({ meta }: { meta: Meta }) {
  const earn = earnFigures(meta);
  const steps = [
    {
      title: "Install Scout",
      body: "Add the browser extension and capture official openings as you browse, or submit from the website.",
    },
    {
      title: "Find an opening",
      body: "On a company careers page or its ATS: Greenhouse, Lever, Ashby, Workday, and more.",
    },
    {
      title: "Submit the official link",
      body: "Company, title, and a job description in your own words. We check it in seconds.",
    },
    {
      title: "Earn when it's used",
      body: `Each qualifying apply credits ${earn.apply}. Interviews and hires pay more. Those rewards hold ${earn.holdDays} days; payouts from ${earn.minPayout}.`,
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
