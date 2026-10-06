package scout

import (
	"math"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/jobschema"
)

// Reward amounts are assumptions from docs/50-pricing-and-revenue.md#scouts.
const (
	// HoldDays applies to approval and hire rewards before they release.
	HoldDays = 14
	// MinPayoutCents is the smallest payout a scout can request.
	MinPayoutCents = 2500
	// ConversionShare is the scout's share of a claimed company's interview fees.
	ConversionShare = 0.1
)

// Leader and Manager used to be paid as senior, so they keep that rate.
var interviewRewardCents = map[string]int64{
	SeniorityJunior:  400,
	SeniorityMiddle:  750,
	SenioritySenior:  1500,
	SeniorityLeader:  1500,
	SeniorityManager: 1500,
}

var hireRewardCents = map[string]int64{
	SeniorityJunior:  2500,
	SeniorityMiddle:  5000,
	SenioritySenior:  10000,
	SeniorityLeader:  10000,
	SeniorityManager: 10000,
}

// RewardTable is shown on the scout level and earnings pages.
type RewardTable struct {
	HoldDays             int              `json:"hold_days"`
	MinPayout            Money            `json:"min_payout"`
	ApplyReward          Money            `json:"apply_reward"`
	InterviewBySeniority map[string]Money `json:"interview_by_seniority"`
	HireBySeniority      map[string]Money `json:"hire_by_seniority"`
	ConversionShare      float64          `json:"conversion_share"`
}

// Rewards returns the reward table with the given config.
func Rewards(cfg Config) RewardTable {
	return RewardTable{
		HoldDays:             HoldDays,
		MinPayout:            cents(MinPayoutCents),
		ApplyReward:          cents(cfg.ApplyRewardCents),
		InterviewBySeniority: moneyMap(interviewRewardCents),
		HireBySeniority:      moneyMap(hireRewardCents),
		ConversionShare:      ConversionShare,
	}
}

// ApprovalReward is paid when a trusted+ scout's job is published.
func ApprovalReward(level string) Money {
	return Rule(level).ApprovalReward
}

// InterviewReward is paid when an interview on the scout's job settles.
func InterviewReward(level, seniority string) Money {
	base := interviewRewardCents[normalizeSeniority(seniority)]
	return cents(int64(math.Round(float64(base) * Rule(level).InterviewMultiplier)))
}

// HireReward is paid when a hire on the scout's job is confirmed.
func HireReward(seniority string) Money {
	return cents(hireRewardCents[normalizeSeniority(seniority)])
}

// HoldUntil is when a reward created at t releases.
func HoldUntil(t time.Time) time.Time {
	return t.Add(HoldDays * 24 * time.Hour)
}

// Balance sums a scout's earnings by status.
type Balance struct {
	Held       Money `json:"held"`
	Released   Money `json:"released"`
	Processing Money `json:"processing"`
	Paid       Money `json:"paid"`
	ClawedBack Money `json:"clawed_back"`
	Lifetime   Money `json:"lifetime"`
}

// ComputeBalance sums earnings; released means available to pay out.
func ComputeBalance(earnings []Earning) Balance {
	var held, released, processing, paid, clawed int64
	for _, e := range earnings {
		switch e.Status {
		case EarningHeld:
			held += e.Amount.AmountCents
		case EarningReleased:
			released += e.Amount.AmountCents
		case EarningProcessing:
			processing += e.Amount.AmountCents
		case EarningPaid:
			paid += e.Amount.AmountCents
		case EarningClawedBack:
			clawed += e.Amount.AmountCents
		}
	}
	return Balance{
		Held:       cents(held),
		Released:   cents(released),
		Processing: cents(processing),
		Paid:       cents(paid),
		ClawedBack: cents(clawed),
		Lifetime:   cents(held + released + processing + paid),
	}
}

// PayoutReadiness lists what still blocks a payout request.
type PayoutReadiness struct {
	Ready    bool     `json:"ready"`
	Blockers []string `json:"blockers"`
}

// CheckPayout applies the payout rules: verified identity, tax info, a payout
// method, and at least the minimum released balance. hasPaidPayout skips the
// stricter first-payout identity fields for scouts who already received money.
func CheckPayout(p Profile, released int64, hasPaidPayout bool) PayoutReadiness {
	blockers := []string{}
	switch p.Verification {
	case VerificationRejected:
		blockers = append(blockers, "Identity verification was declined")
	case VerificationVerified:
		if !hasPaidPayout {
			if !IdentityFieldsPresent(p) {
				blockers = append(blockers, "Complete identity details (legal name, country, date of birth)")
			} else if p.PayoutMethod != nil && strings.TrimSpace(p.PayoutMethod.HolderName) != "" && !PayoutHolderMatches(p) {
				blockers = append(blockers, "Payout account holder name must match legal name")
			} else if p.PayoutMethod != nil && strings.TrimSpace(p.PayoutMethod.HolderName) == "" {
				blockers = append(blockers, "Add the payout account holder name")
			}
		}
	default:
		blockers = append(blockers, "Verify your identity (tier 2)")
	}
	switch {
	case p.TaxInfo == nil:
		blockers = append(blockers, "Add tax information")
	case !TaxFormReady(p.TaxInfo):
		blockers = append(blockers, "Add a W-9 or W-8BEN")
	case p.TaxInfo.ScreeningStatus != ScreeningClear:
		blockers = append(blockers, "Sanction screening must be clear")
	}
	if p.PayoutMethod == nil {
		blockers = append(blockers, "Add a payout method")
	}
	if released < MinPayoutCents {
		blockers = append(blockers, "Reach the minimum released balance")
	}
	return PayoutReadiness{Ready: len(blockers) == 0, Blockers: blockers}
}

// Tier maps profile facts to the identity tiers in docs/10-identity-and-accounts.md.
func Tier(p Profile) int {
	switch {
	case p.Verification == VerificationVerified:
		return 2
	case p.TermsAcceptedAt != nil:
		return 1
	default:
		return 0
	}
}

func cents(amount int64) Money { return Money{AmountCents: amount, Currency: Currency} }

func moneyMap(values map[string]int64) map[string]Money {
	out := make(map[string]Money, len(values))
	for key, value := range values {
		out[key] = cents(value)
	}
	return out
}

func normalizeSeniority(value string) string {
	if canonical, ok := jobschema.CanonicalSeniority(value); ok {
		return canonical
	}
	return SeniorityMiddle
}
