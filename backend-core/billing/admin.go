package billing

import (
	"context"
	"strings"
	"time"
)

// AdminCancel ends Joined Premium immediately. It updates the stored subscription
// and does not call Stripe, so tests and CI never issue a live refund.
func (s *Service) AdminCancel(ctx context.Context, userID, reason string, now time.Time) error {
	if strings.TrimSpace(userID) == "" {
		return ErrMissingUserID
	}
	if strings.TrimSpace(reason) == "" {
		return ErrInvalidEvent
	}
	sub, err := s.Store.SubscriptionByUser(ctx, userID)
	if err != nil {
		return err
	}
	sub.Status = string(StatusCanceled)
	sub.CurrentPeriodEnd = now.UTC()
	sub.UpdatedAt = now.UTC()
	return s.Store.UpsertSubscription(ctx, sub)
}

// AdminRefund records a staff refund against the stored subscription.
// amountCents must be positive. Live Stripe is not called.
func (s *Service) AdminRefund(ctx context.Context, userID, reason string, amountCents int64, now time.Time) error {
	if strings.TrimSpace(userID) == "" {
		return ErrMissingUserID
	}
	if strings.TrimSpace(reason) == "" || amountCents <= 0 {
		return ErrInvalidEvent
	}
	sub, err := s.Store.SubscriptionByUser(ctx, userID)
	if err != nil {
		return err
	}
	sub.RefundedCents += amountCents
	sub.UpdatedAt = now.UTC()
	return s.Store.UpsertSubscription(ctx, sub)
}

// AdminStatus reports whether the user has Joined Premium and the stored status.
func (s *Service) AdminStatus(ctx context.Context, userID string) (bool, string, error) {
	sub, err := s.Store.SubscriptionByUser(ctx, userID)
	if err != nil {
		return false, "", err
	}
	return sub.IsPremium(s.now()), sub.Status, nil
}
