package billing

import (
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

// WebhookRouter routes Stripe webhook events to handlers.
type WebhookRouter struct {
	WebhookSecret string
	Idempotency   IdempotencyStore
	Handlers      map[string]WebhookHandler
}

// WebhookHandler processes a Stripe event.
type WebhookHandler func(event Event) error

// Event is a Stripe webhook event.
type Event struct {
	ID      string          `json:"id"`
	Type    string          `json:"type"`
	Created int64           `json:"created"`
	Data    json.RawMessage `json:"data"`
}

// NewWebhookRouter creates a webhook router with stubbed handlers.
func NewWebhookRouter(webhookSecret string, store IdempotencyStore) *WebhookRouter {
	return &WebhookRouter{
		WebhookSecret: webhookSecret,
		Idempotency:   store,
		Handlers: map[string]WebhookHandler{
			"checkout.session.completed":    handleCheckoutSessionCompleted,
			"customer.subscription.created": handleSubscriptionCreated,
			"customer.subscription.updated": handleSubscriptionUpdated,
			"customer.subscription.deleted": handleSubscriptionDeleted,
		},
	}
}

// ServeHTTP processes a webhook POST from Stripe.
func (w *WebhookRouter) ServeHTTP(rw http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(rw, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(rw, "read body", http.StatusBadRequest)
		return
	}
	signature := r.Header.Get("Stripe-Signature")
	if !w.verifySignature(body, signature) {
		slog.Warn("webhook signature verification failed")
		http.Error(rw, "invalid signature", http.StatusUnauthorized)
		return
	}
	var event Event
	if err := json.Unmarshal(body, &event); err != nil {
		http.Error(rw, "invalid event", http.StatusBadRequest)
		return
	}
	if w.Idempotency.IsProcessed(event.ID) {
		slog.Info("webhook event already processed", "event_id", event.ID)
		rw.WriteHeader(http.StatusOK)
		return
	}
	handler, ok := w.Handlers[event.Type]
	if !ok {
		slog.Info("no handler for event type", "type", event.Type)
		w.Idempotency.MarkProcessed(event.ID)
		rw.WriteHeader(http.StatusOK)
		return
	}
	if err := handler(event); err != nil {
		slog.Error("webhook handler failed", "type", event.Type, "error", err)
		http.Error(rw, "handler error", http.StatusInternalServerError)
		return
	}
	w.Idempotency.MarkProcessed(event.ID)
	rw.WriteHeader(http.StatusOK)
}

func (w *WebhookRouter) verifySignature(payload []byte, header string) bool {
	if w.WebhookSecret == "" {
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
	now := time.Now().Unix()
	skew := now - ts
	if skew < 0 {
		skew = -skew
	}
	if skew > 300 {
		return false
	}
	signedPayload := fmt.Sprintf("%s.%s", timestamp, payload)
	mac := hmac.New(sha256.New, []byte(w.WebhookSecret))
	mac.Write([]byte(signedPayload))
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(signature), []byte(expected))
}

func handleCheckoutSessionCompleted(event Event) error {
	slog.Info("checkout session completed", "event_id", event.ID)
	return nil
}

func handleSubscriptionCreated(event Event) error {
	slog.Info("subscription created", "event_id", event.ID)
	return nil
}

func handleSubscriptionUpdated(event Event) error {
	slog.Info("subscription updated", "event_id", event.ID)
	return nil
}

func handleSubscriptionDeleted(event Event) error {
	slog.Info("subscription deleted", "event_id", event.ID)
	return nil
}
