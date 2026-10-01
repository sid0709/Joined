package employer

import "github.com/sid0709/OpenSeat/backend-core/candidate"

func validatePurchase(cents int) error {
	if cents < MinPurchaseCents || cents > MaxPurchaseCents {
		return ErrInvalidInput
	}
	return nil
}

func assistedFrom(source string) string {
	switch source {
	case candidate.SourceDirect:
		return "direct"
	case candidate.SourceManual:
		return "bidder"
	default:
		return "agent"
	}
}
