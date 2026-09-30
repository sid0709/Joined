import { Badge, Button } from "@openseat/design-system";
import { formatMoney, formatRate, type Meta } from "@openseat/scout";
import { ROUTES } from "@/lib/routes";
import { ApiBand } from "./api-band";
import { HowItWorks } from "./how-it-works";
import { LevelTiers } from "./level-tiers";

function rewardRanges(meta: Meta) {
  const { rewards } = meta;
  return {
    interviews: `${formatMoney(rewards.interview_by_seniority.Junior)}–${formatMoney(rewards.interview_by_seniority.Senior)}`,
    hires: `${formatMoney(rewards.hire_by_seniority.Junior)}–${formatMoney(rewards.hire_by_seniority.Senior)}`,
  };
}

export function LandingPage({ meta, signedIn }: { meta: Meta; signedIn: boolean }) {
  const ranges = rewardRanges(meta);
  const topMultiplier = Math.max(...meta.levels.map((level) => level.interview_multiplier));
  const figures = [
    {
      label: "Per settled interview",
      value: ranges.interviews,
      hint: `By seniority, up to ×${topMultiplier} at the top level.`,
    },
    {
      label: "Per confirmed hire",
      value: ranges.hires,
      hint: "Paid when an employer confirms the hire on your job.",
    },
    {
      label: "Company conversion",
      value: formatRate(meta.rewards.conversion_share),
      hint: "Of a company's interview fees when it claims its page.",
    },
  ];

  return (
    <div className="sw-landing">
      <section className="sw-landing-hero sw-rise">
        <Badge label="For scouts and sourcing partners" variant="blue" />
        <h1 className="sw-display">
          Find the jobs the big boards miss.{" "}
          <span className="sw-gradient-text">Get paid when they&apos;re used.</span>
        </h1>
        <p className="sw-lede">
          Submit official openings from company sites. When job hunters apply, interview, and get
          hired through them, you earn — never for raw volume.
        </p>
        <div className="sw-cta-row">
          {signedIn ? (
            <Button
              label="Go to your dashboard"
              variant="primary"
              size="lg"
              href={ROUTES.dashboard}
            />
          ) : (
            <>
              <Button label="Become a scout" variant="primary" size="lg" href={ROUTES.signUp} />
              <Button label="Sign in" variant="secondary" size="lg" href={ROUTES.signIn} />
            </>
          )}
        </div>
      </section>

      <dl className="sw-figures">
        {figures.map((figure, index) => (
          <div
            key={figure.label}
            className="sw-figure sw-rise"
            style={{ ["--sw-index" as string]: index + 1 }}
          >
            <dt>{figure.label}</dt>
            <dd className="sw-figure-value">{figure.value}</dd>
            <dd className="sw-figure-hint">{figure.hint}</dd>
          </div>
        ))}
      </dl>

      <HowItWorks meta={meta} />
      <LevelTiers meta={meta} />
      <ApiBand maxBatch={meta.limits.max_batch} signedIn={signedIn} />
    </div>
  );
}
