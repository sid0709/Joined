package scout

import "testing"

func TestRewardTitleApply(t *testing.T) {
	if got := rewardTitle(RewardApply); got != "Apply reward" {
		t.Errorf("rewardTitle(%q) = %q, want %q", RewardApply, got, "Apply reward")
	}
}
