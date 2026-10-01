import { Badge } from "@joined/design-system";
import { LEVEL_BADGE, formatMoney, type Meta } from "@joined/scout";

/** The three scout levels side by side; the last is the one to aim for. */
export function LevelTiers({ meta }: { meta: Meta }) {
  const top = meta.levels.at(-1)?.id;
  return (
    <section className="sw-section" aria-labelledby="sw-levels">
      <div className="sw-section-head">
        <span className="sw-eyebrow">Levels</span>
        <h2 id="sw-levels" className="sw-section-title">
          Quality raises your limit and your rewards.
        </h2>
      </div>
      <div className="sw-tiers">
        {meta.levels.map((level) => (
          <article key={level.id} className="sw-tier" data-featured={level.id === top}>
            <Badge label={level.label} variant={LEVEL_BADGE[level.id]} />
            <div>
              <span className="sw-tier-limit">{level.daily_limit}</span>
              <span className="sw-tier-unit"> jobs a day</span>
            </div>
            <ul className="sw-tier-points">
              <li>
                {level.auto_approve
                  ? "Clean jobs publish automatically"
                  : "A moderator reviews every job"}
              </li>
              <li>
                {level.approval_reward.amount_cents > 0
                  ? `${formatMoney(level.approval_reward)} per approved job`
                  : "No approval credit yet"}
              </li>
              <li>×{level.interview_multiplier} interview rewards</li>
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
