package scout

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	// PayoutWebhookPath is the provider callback mounted on scoutwell-backend.
	PayoutWebhookPath = "/v1/webhooks/payouts"

	payoutSignatureHeader = "Payout-Signature"
	payoutWebhookSkew     = 5 * time.Minute
	maxPayoutWebhookBytes = 128 << 10
)

// ProviderEvent is a provider-agnostic payout status callback.
type ProviderEvent struct {
	ID          string `json:"id"`
	PayoutID    string `json:"payout_id"`
	ProviderRef string `json:"provider_ref"`
	Status      string `json:"status"`
}

// PayoutWebhook verifies signed provider callbacks and applies status updates.
type PayoutWebhook struct {
	Secret string
	Store  *Store
}

// NewPayoutWebhook builds the scoutwell-backend webhook handler.
func NewPayoutWebhook(store *Store, secret string) *PayoutWebhook {
	return &PayoutWebhook{Secret: secret, Store: store}
}

func (h *PayoutWebhook) ServeHTTP(rw http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(rw, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, maxPayoutWebhookBytes))
	if err != nil {
		http.Error(rw, "read body", http.StatusBadRequest)
		return
	}
	if !VerifyPayoutSignature(h.Secret, body, r.Header.Get(payoutSignatureHeader), time.Now()) {
		slog.Warn("payout webhook signature verification failed")
		http.Error(rw, "invalid signature", http.StatusUnauthorized)
		return
	}
	var event ProviderEvent
	if err := json.Unmarshal(body, &event); err != nil {
		http.Error(rw, "invalid event", http.StatusBadRequest)
		return
	}
	if h.Store == nil {
		http.Error(rw, "handler error", http.StatusInternalServerError)
		return
	}
	if _, err := h.Store.ApplyProviderEvent(r.Context(), event); err != nil {
		slog.Error("payout webhook apply", "error", err)
		http.Error(rw, "handler error", http.StatusInternalServerError)
		return
	}
	rw.WriteHeader(http.StatusOK)
}

// VerifyPayoutSignature checks t=<unix>,v1=<hex hmac sha256 of timestamp.payload>.
func VerifyPayoutSignature(secret string, payload []byte, header string, now time.Time) bool {
	if secret == "" {
		return false
	}
	parts := strings.Split(header, ",")
	var timestamp, signature string
	for _, part := range parts {
		kv := strings.SplitN(part, "=", 2)
		if len(kv) != 2 {
			continue
		}
		switch kv[0] {
		case "t":
			timestamp = kv[1]
		case "v1":
			signature = kv[1]
		}
	}
	if timestamp == "" || signature == "" {
		return false
	}
	ts, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return false
	}
	skew := now.Unix() - ts
	if skew < 0 {
		skew = -skew
	}
	if time.Duration(skew)*time.Second > payoutWebhookSkew {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	fmt.Fprintf(mac, "%s.", timestamp)
	mac.Write(payload)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(signature), []byte(expected))
}

// SignPayoutPayload builds the Payout-Signature header for tests and the fake rail.
func SignPayoutPayload(secret string, payload []byte, at time.Time) string {
	timestamp := strconv.FormatInt(at.Unix(), 10)
	mac := hmac.New(sha256.New, []byte(secret))
	fmt.Fprintf(mac, "%s.", timestamp)
	mac.Write(payload)
	return fmt.Sprintf("t=%s,v1=%s", timestamp, hex.EncodeToString(mac.Sum(nil)))
}

// ApplyProviderEvent updates a payout from a signed webhook or poll result.
func (s *Store) ApplyProviderEvent(ctx context.Context, event ProviderEvent) (Payout, error) {
	s.payoutMu.Lock()
	defer s.payoutMu.Unlock()

	payout, err := s.lookupProviderPayout(ctx, event.PayoutID, event.ProviderRef)
	if err != nil {
		return Payout{}, err
	}
	if event.ID != "" && event.ID == payout.ProviderEventID {
		return payout, nil
	}
	status := MapProviderStatus(event.Status)
	updated, err := s.applyRailStatus(ctx, payout, status, event.ProviderRef, event.ID)
	if err != nil {
		return Payout{}, err
	}
	return updated, nil
}

// RefreshPayoutFromProvider polls the rail and applies the current status.
func (s *Store) RefreshPayoutFromProvider(ctx context.Context, id string) (Payout, error) {
	s.payoutMu.Lock()
	defer s.payoutMu.Unlock()

	payout, err := s.payout(ctx, id)
	if err != nil {
		return Payout{}, err
	}
	if payout.ProviderRef == "" {
		return payout, fmt.Errorf("payout has no provider reference")
	}
	result, err := s.provider().GetPayout(ctx, payout.ProviderRef)
	if err != nil {
		return Payout{}, fmt.Errorf("get payout: %w", err)
	}
	return s.applyRailStatus(ctx, payout, MapProviderStatus(result.Status), result.ProviderRef, "")
}

func (s *Store) lookupProviderPayout(ctx context.Context, payoutID, providerRef string) (Payout, error) {
	if payoutID != "" {
		payout, err := s.payout(ctx, payoutID)
		if err == nil {
			return payout, nil
		}
		if err != ErrNotFound {
			return Payout{}, err
		}
	}
	if providerRef == "" {
		return Payout{}, ErrNotFound
	}
	return s.payoutByProviderRef(ctx, providerRef)
}
