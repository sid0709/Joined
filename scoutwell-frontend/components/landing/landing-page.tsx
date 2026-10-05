import { Badge, Button } from "sid-ui";
import { type Meta } from "@joined/scout";
import { ROUTES } from "@/lib/routes";
import { earnFigures } from "@/lib/site-copy";
import { ApiBand } from "./api-band";
import { HowItWorks } from "./how-it-works";
import { LevelTiers } from "./level-tiers";

export function LandingPage({ meta, signedIn }: { meta: Meta; signedIn: boolean }) {
  const figures = earnFigures(meta);
  const topMultiplier = Math.max(...meta.levels.map((level) => level.interview_multiplier));
  const stats = [
    {
      label: "Per qualifying apply",
      value: figures.apply,
      hint: "One credit per candidate per job you submitted.",
    },
    {
      label: "Per settled interview",
      value: figures.interviews,
      hint: `By seniority, up to ×${topMultiplier} at the top level.`,
    },
    {
      label: "Per confirmed hire",
      value: figures.hires,
      hint: "Paid when an employer confirms the hire on your job.",
    },
    {
      label: "Company conversion",
      value: figures.conversion,
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
              <Button
                label="Install the extension"
                variant="secondary"
                size="lg"
                href={ROUTES.install}
              />
              <Button label="Sign in" variant="ghost" size="lg" href={ROUTES.signIn} />
            </>
          )}
        </div>
      </section>

      <dl className="sw-figures">
        {stats.map((figure, index) => (
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
