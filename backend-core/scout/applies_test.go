package scout

import (
	"testing"
)

func TestApplyReward(t *testing.T) {
	reward := ApplyReward()
	if reward.AmountCents != ApplyRewardCents {
		t.Errorf("ApplyReward().AmountCents = %d, want %d", reward.AmountCents, ApplyRewardCents)
	}
	if reward.Currency != Currency {
		t.Errorf("ApplyReward().Currency = %q, want %q", reward.Currency, Currency)
	}
}

func TestApplyRewardInRewardTable(t *testing.T) {
	table := Rewards()
	if table.ApplyReward.AmountCents != ApplyRewardCents {
		t.Errorf("Rewards().ApplyReward.AmountCents = %d, want %d", table.ApplyReward.AmountCents, ApplyRewardCents)
	}
}
