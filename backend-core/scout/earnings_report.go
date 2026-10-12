package scout

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// StaffEarningsReport is the staff export of earning totals by status.
type StaffEarningsReport struct {
	From   time.Time        `json:"from"`
	To     time.Time        `json:"to"`
	Totals map[string]int64 `json:"totals"`
}

// EarningsReport sums earning cents in [from, to] by status. It does not include names.
func (s *Store) EarningsReport(ctx context.Context, from, to time.Time) (StaffEarningsReport, error) {
	all, err := s.allEarnings(ctx, bson.D{})
	if err != nil {
		return StaffEarningsReport{}, err
	}
	totals := map[string]int64{
		EarningHeld:       0,
		EarningReleased:   0,
		EarningPaid:       0,
		EarningClawedBack: 0,
	}
	for _, earning := range all {
		if !from.IsZero() && earning.CreatedAt.Before(from) {
			continue
		}
		if !to.IsZero() && earning.CreatedAt.After(to) {
			continue
		}
		if _, ok := totals[earning.Status]; !ok {
			continue
		}
		totals[earning.Status] += earning.Amount.AmountCents
	}
	return StaffEarningsReport{From: from, To: to, Totals: totals}, nil
}

// ClawbackUnsettled moves a held or released earning to clawed_back.
// A paid earning is refused so a provider send is not reversed.
func (s *Store) ClawbackUnsettled(ctx context.Context, id string) (Earning, error) {
	objectID, err := bson.ObjectIDFromHex(id)
	if err != nil {
		return Earning{}, ErrNotFound
	}
	if mem, ok := s.docs.(*memDocs); ok {
		earning, err := mem.earningByID(objectID)
		if err != nil {
			return Earning{}, err
		}
		if earning.Status == EarningPaid {
			return Earning{}, ErrEarningSettled
		}
		if earning.Status == EarningClawedBack {
			return earning, nil
		}
		if earning.Status != EarningHeld && earning.Status != EarningReleased {
			return Earning{}, ErrConflict
		}
		return mem.setEarningStatus(objectID, EarningClawedBack)
	}
	var earning Earning
	err = s.collection(earningsCollection).FindOne(ctx, bson.D{{Key: "_id", Value: objectID}}).Decode(&earning)
	if err != nil {
		return Earning{}, ErrNotFound
	}
	earning.fill()
	if earning.Status == EarningPaid {
		return Earning{}, ErrEarningSettled
	}
	if earning.Status == EarningClawedBack {
		return earning, nil
	}
	if earning.Status != EarningHeld && earning.Status != EarningReleased {
		return Earning{}, ErrConflict
	}
	_, err = s.collection(earningsCollection).UpdateOne(ctx, bson.D{{Key: "_id", Value: objectID}}, bson.D{
		{Key: "$set", Value: bson.D{{Key: "status", Value: EarningClawedBack}}},
	})
	if err != nil {
		return Earning{}, err
	}
	earning.Status = EarningClawedBack
	return earning, nil
}
