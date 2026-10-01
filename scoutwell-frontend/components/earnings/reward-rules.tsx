import { MetadataList, MetadataListItem, Text } from "@joined/design-system";
import {
  SENIORITIES,
  SENIORITY_LABEL,
  formatMoney,
  formatRate,
  type LevelRule,
  type RewardTable,
} from "@joined/scout";

/** What each kind of reward pays, at this scout's level. */
export function RewardRules({ rewards, level }: { rewards: RewardTable; level: LevelRule }) {
  return (
    <>
      <MetadataList columns="single">
        <MetadataListItem label="Approval (your level)">
          {formatMoney(level.approval_reward)}
        </MetadataListItem>
        {SENIORITIES.map((seniority) => (
          <MetadataListItem key={seniority} label={`${SENIORITY_LABEL[seniority]} role`}>
            {formatMoney(rewards.interview_by_seniority[seniority])} per interview ·{" "}
            {formatMoney(rewards.hire_by_seniority[seniority])} per hire
          </MetadataListItem>
        ))}
        <MetadataListItem label="Company conversion">
          {formatRate(rewards.conversion_share)} of that company&apos;s interview fees
        </MetadataListItem>
      </MetadataList>
      <Text type="supporting" color="secondary" display="block">
        Interview rewards multiply by {level.interview_multiplier}× at your level. Rewards on jobs
        later found to be fake are clawed back.
      </Text>
    </>
  );
}
