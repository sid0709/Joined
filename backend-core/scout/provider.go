package scout

import (
	"context"
	"strings"
)

// Provider is a global payout rail. Tests and local dev use FakeProvider.
type Provider interface {
	CreateRecipient(ctx context.Context, rec Recipient) (RecipientResult, error)
	SendPayout(ctx context.Context, xfer Transfer) (TransferResult, error)
	GetPayout(ctx context.Context, providerRef string) (TransferResult, error)
}

// Recipient is the provider-facing payout destination. Callers send country,
// currency, and an email or opaque account reference — never a raw bank number.
type Recipient struct {
	ScoutUserID string
	Country     string
	Currency    string
	Email       string
	AccountRef  string
	Label       string
}

// RecipientResult is the opaque id the rail assigned to a destination.
type RecipientResult struct {
	RecipientID string
}

// Transfer is one payout to send. PayoutID is the idempotency key.
type Transfer struct {
	PayoutID    string
	RecipientID string
	AmountCents int64
	Currency    string
}

// TransferResult is the rail's view of a payout.
type TransferResult struct {
	ProviderRef string
	Status      string
}

// Provider statuses the rails report. Store payouts map these onto Payout*.
const (
	ProviderStatusSent   = "sent"
	ProviderStatusPaid   = "paid"
	ProviderStatusFailed = "failed"
)

// NormalizeProviderStatus folds vendor status strings onto sent, paid, or failed.
func NormalizeProviderStatus(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case ProviderStatusPaid, "completed", "success", "processed":
		return ProviderStatusPaid
	case ProviderStatusFailed, "error", "returned", "canceled", "cancelled", "reversed", "denied":
		return ProviderStatusFailed
	default:
		return ProviderStatusSent
	}
}

// MapProviderStatus converts a rail status onto a stored payout status.
func MapProviderStatus(status string) string {
	switch NormalizeProviderStatus(status) {
	case ProviderStatusPaid:
		return PayoutPaid
	case ProviderStatusFailed:
		return PayoutFailed
	default:
		return PayoutSent
	}
}
