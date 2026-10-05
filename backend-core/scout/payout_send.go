package scout

import (
	"context"
	"fmt"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// SendApprovedPayout sends an approved payout to the rail. Requested payouts
// are refused so the staff approval step stays the gate. The payout id is the
// idempotency key: retries replay the same provider transfer.
func (s *Store) SendApprovedPayout(ctx context.Context, id string) (Payout, error) {
	s.payoutMu.Lock()
	defer s.payoutMu.Unlock()
	payout, err := s.payout(ctx, id)
	if err != nil {
		return Payout{}, err
	}
	return s.sendApprovedLocked(ctx, payout)
}

func (s *Store) sendApprovedLocked(ctx context.Context, payout Payout) (Payout, error) {
	switch payout.Status {
	case PayoutPaid, PayoutRejected, PayoutFailed:
		return Payout{}, ErrAlreadyDecided
	case PayoutRequested:
		return Payout{}, ErrPayoutNotApproved
	case PayoutApproved, PayoutSent:
	default:
		return Payout{}, ErrPayoutNotApproved
	}
	if payout.Status == PayoutSent && payout.ProviderRef != "" {
		return payout, nil
	}
	return s.dispatchPayout(ctx, payout)
}

func (s *Store) dispatchPayout(ctx context.Context, payout Payout) (Payout, error) {
	if payout.Method.RecipientID == "" {
		result, err := s.provider().CreateRecipient(ctx, recipientFromMethod(payout.ScoutUserID, payout.Method))
		if err != nil {
			return s.failPayout(ctx, payout, fmt.Sprintf("create recipient: %v", err))
		}
		payout.Method.RecipientID = result.RecipientID
	}
	now := s.now().UTC()
	xfer, err := s.provider().SendPayout(ctx, Transfer{
		PayoutID:    payout.ID,
		RecipientID: payout.Method.RecipientID,
		AmountCents: payout.Amount.AmountCents,
		Currency:    payoutCurrency(payout),
	})
	if err != nil {
		return s.failPayout(ctx, payout, err.Error())
	}
	status := MapProviderStatus(xfer.Status)
	if status == PayoutFailed {
		return s.failPayout(ctx, payout, "provider reported failure")
	}
	payout.ProviderRef = xfer.ProviderRef
	payout.ProviderStatus = NormalizeProviderStatus(xfer.Status)
	payout.Status = status
	if payout.SentAt == nil {
		payout.SentAt = &now
	}
	if status == PayoutPaid {
		if err := s.settlePayoutEarnings(ctx, payout.ID, now, true); err != nil {
			return Payout{}, err
		}
		payout.DecidedAt = &now
		s.notify(ctx, payout.ScoutUserID, notice{kind: kindPayout, tone: toneSuccess, title: "Payout sent", body: formatMoney(payout.Amount) + " was sent to " + payout.Method.Label + ".", subjectID: payout.ID})
	} else {
		payout.Status = PayoutSent
		s.notify(ctx, payout.ScoutUserID, notice{kind: kindPayout, tone: toneAccent, title: "Payout on the way", body: formatMoney(payout.Amount) + " is being sent to " + payout.Method.Label + ".", subjectID: payout.ID})
	}
	if err := s.savePayout(ctx, payout); err != nil {
		return Payout{}, err
	}
	return s.payout(ctx, payout.ID)
}

func (s *Store) failPayout(ctx context.Context, payout Payout, detail string) (Payout, error) {
	now := s.now().UTC()
	if err := s.settlePayoutEarnings(ctx, payout.ID, now, false); err != nil {
		return Payout{}, err
	}
	payout.Status = PayoutFailed
	payout.ProviderStatus = ProviderStatusFailed
	payout.Note = detail
	payout.FailedAt = &now
	payout.DecidedAt = &now
	if err := s.savePayout(ctx, payout); err != nil {
		return Payout{}, err
	}
	s.notify(ctx, payout.ScoutUserID, notice{kind: kindPayout, tone: toneDanger, title: "Payout failed", body: "Your available balance was restored. " + detail, subjectID: payout.ID})
	return s.payout(ctx, payout.ID)
}

func (s *Store) applyRailStatus(ctx context.Context, payout Payout, status, providerRef, eventID string) (Payout, error) {
	if !canApplyPayoutStatus(payout.Status, status) {
		return payout, nil
	}
	now := s.now().UTC()
	if providerRef != "" {
		payout.ProviderRef = providerRef
	}
	if eventID != "" {
		payout.ProviderEventID = eventID
	}
	payout.ProviderStatus = NormalizeProviderStatus(status)
	switch status {
	case PayoutPaid:
		if err := s.settlePayoutEarnings(ctx, payout.ID, now, true); err != nil {
			return Payout{}, err
		}
		payout.Status = PayoutPaid
		payout.DecidedAt = &now
		if payout.SentAt == nil {
			payout.SentAt = &now
		}
		s.notify(ctx, payout.ScoutUserID, notice{kind: kindPayout, tone: toneSuccess, title: "Payout sent", body: formatMoney(payout.Amount) + " was sent to " + payout.Method.Label + ".", subjectID: payout.ID})
	case PayoutFailed:
		return s.failPayout(ctx, payout, "provider reported failure")
	case PayoutSent:
		payout.Status = PayoutSent
		if payout.SentAt == nil {
			payout.SentAt = &now
		}
	default:
		return payout, nil
	}
	if err := s.savePayout(ctx, payout); err != nil {
		return Payout{}, err
	}
	return s.payout(ctx, payout.ID)
}

func canApplyPayoutStatus(current, next string) bool {
	switch current {
	case PayoutPaid, PayoutRejected:
		return false
	case PayoutFailed:
		return next == PayoutFailed
	case PayoutSent:
		return next == PayoutPaid || next == PayoutFailed || next == PayoutSent
	case PayoutApproved, PayoutRequested:
		return next == PayoutSent || next == PayoutPaid || next == PayoutFailed
	default:
		return false
	}
}

func (s *Store) provider() Provider {
	if s.payoutProvider == nil {
		return NewFakeProvider()
	}
	return s.payoutProvider
}

func payoutCurrency(payout Payout) string {
	if payout.Method.Currency != "" {
		return payout.Method.Currency
	}
	if payout.Amount.Currency != "" {
		return payout.Amount.Currency
	}
	return Currency
}

func recipientFromMethod(userID string, method PayoutMethod) Recipient {
	return Recipient{
		ScoutUserID: userID,
		Country:     method.Country,
		Currency:    method.Currency,
		Email:       method.Email,
		AccountRef:  method.AccountRef,
		Label:       method.Label,
	}
}

func (s *Store) approvePayout(ctx context.Context, payout Payout, actor, note string) (Payout, error) {
	if payout.Status != PayoutRequested {
		if payout.Status == PayoutApproved || payout.Status == PayoutSent {
			return s.sendApprovedLocked(ctx, payout)
		}
		return Payout{}, ErrAlreadyDecided
	}
	now := s.now().UTC()
	payout.Status = PayoutApproved
	payout.Note = note
	payout.ApprovedAt = &now
	payout.DecidedAt = &now
	if err := s.savePayout(ctx, payout); err != nil {
		return Payout{}, err
	}
	s.audit(ctx, "payout.approved", "scout_payout", payout.ID, actor, note)
	updated, err := s.payout(ctx, payout.ID)
	if err != nil {
		return Payout{}, err
	}
	return s.sendApprovedLocked(ctx, updated)
}

func pendingPayoutStatuses() bson.A {
	return bson.A{PayoutRequested, PayoutApproved, PayoutSent}
}
