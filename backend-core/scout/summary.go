package scout

import (
	"context"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// EarningsSummary breaks down a scout's earnings by reward type.
type EarningsSummary struct {
	ByType map[string]Money `json:"by_type"`
	Total  Money            `json:"total"`
}

// EarningsSummary computes the breakdown of released earnings by reward type.
func (s *Store) EarningsSummary(ctx context.Context, userID string) (EarningsSummary, error) {
	if err := s.releaseDue(ctx); err != nil {
		return EarningsSummary{}, err
	}

	// Get all released earnings
	all, err := s.allEarnings(ctx, bson.D{
		{Key: "scoutUserId", Value: userID},
		{Key: "status", Value: EarningReleased},
	})
	if err != nil {
		return EarningsSummary{}, err
	}

	byType := make(map[string]int64)
	var total int64

	for _, earning := range all {
		byType[earning.Type] += earning.Amount.AmountCents
		total += earning.Amount.AmountCents
	}

	result := EarningsSummary{
		ByType: make(map[string]Money, len(byType)),
		Total:  cents(total),
	}

	for typ, amount := range byType {
		result.ByType[typ] = cents(amount)
	}

	return result, nil
}
