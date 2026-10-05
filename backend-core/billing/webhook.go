package billing

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
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

// NewWebhookRouter creates a webhook router. Call UseService to persist subscriptions.
func NewWebhookRouter(webhookSecret string, store IdempotencyStore) *WebhookRouter {
	return &WebhookRouter{
		WebhookSecret: webhookSecret,
		Idempotency:   store,
		Handlers: map[string]WebhookHandler{
			EventCheckoutSessionCompleted: handleCheckoutSessionCompleted,
			EventSubscriptionCreated:      handleSubscriptionCreated,
			EventSubscriptionUpdated:      handleSubscriptionUpdated,
			EventSubscriptionDeleted:      handleSubscriptionDeleted,
		},
	}
}

// UseService replaces stub handlers with Service methods that persist subscriptions.
func (w *WebhookRouter) UseService(service *Service) {
	if service == nil {
		return
	}
	w.Handlers[EventCheckoutSessionCompleted] = service.handleCheckoutSessionCompleted
	w.Handlers[EventSubscriptionCreated] = service.handleSubscriptionCreated
	w.Handlers[EventSubscriptionUpdated] = service.handleSubscriptionUpdated
	w.Handlers[EventSubscriptionDeleted] = service.handleSubscriptionDeleted
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

func (s *Service) handleCheckoutSessionCompleted(event Event) error {
	return s.ApplyCheckoutCompleted(context.Background(), event)
}

func (s *Service) handleSubscriptionCreated(event Event) error {
	return s.ApplySubscriptionEvent(context.Background(), event)
}

func (s *Service) handleSubscriptionUpdated(event Event) error {
	return s.ApplySubscriptionEvent(context.Background(), event)
}

func (s *Service) handleSubscriptionDeleted(event Event) error {
	return s.ApplySubscriptionEvent(context.Background(), event)
}

// ApplyCheckoutCompleted maps the Stripe customer to a Joined user and upserts
// a subscription when the Checkout session includes one.
func (s *Service) ApplyCheckoutCompleted(ctx context.Context, event Event) error {
	raw, err := eventObject(event)
	if err != nil {
		return err
	}
	var session stripeCheckoutEvent
	if err := json.Unmarshal(raw, &session); err != nil {
		return fmt.Errorf("decode checkout session: %w", err)
	}
	userID := firstNonEmpty(session.ClientReferenceID, session.Metadata[metadataUserIDKey])
	customerID := parseStripeID(session.Customer)
	if userID == "" {
		return fmt.Errorf("%w: checkout session %s", ErrMissingUserID, session.ID)
	}
	if customerID != "" {
		if err := s.Store.UpsertCustomer(ctx, userID, customerID); err != nil {
			return fmt.Errorf("map checkout customer: %w", err)
		}
	}
	subscriptionID := parseStripeID(session.Subscription)
	if subscriptionID == "" {
		return nil
	}
	plan := parsePlanMetadata(session.Metadata[metadataPlanKey])
	return s.Store.UpsertSubscription(ctx, Subscription{
		UserID:               userID,
		StripeCustomerID:     customerID,
		StripeSubscriptionID: subscriptionID,
		Status:               string(StatusActive),
		Plan:                 plan,
		UpdatedAt:            s.now(),
	})
}

// ApplySubscriptionEvent upserts the subscriptions record from created/updated/deleted.
func (s *Service) ApplySubscriptionEvent(ctx context.Context, event Event) error {
	raw, err := eventObject(event)
	if err != nil {
		return err
	}
	var stripeSub stripeSubscriptionEvent
	if err := json.Unmarshal(raw, &stripeSub); err != nil {
		return fmt.Errorf("decode subscription: %w", err)
	}
	if stripeSub.ID == "" {
		return fmt.Errorf("%w: subscription missing id", ErrInvalidEvent)
	}
	customerID := parseStripeID(stripeSub.Customer)
	userID := firstNonEmpty(stripeSub.Metadata[metadataUserIDKey])
	if userID == "" && customerID != "" {
		mapped, mapErr := s.Store.UserIDByCustomer(ctx, customerID)
		if mapErr != nil && !errors.Is(mapErr, ErrNotFound) {
			return fmt.Errorf("lookup user by customer: %w", mapErr)
		}
		userID = mapped
	}
	if userID == "" {
		return fmt.Errorf("%w: subscription %s", ErrMissingUserID, stripeSub.ID)
	}
	if customerID != "" {
		if err := s.Store.UpsertCustomer(ctx, userID, customerID); err != nil {
			return fmt.Errorf("map subscription customer: %w", err)
		}
	}
	status := stripeSub.Status
	if event.Type == EventSubscriptionDeleted && status == "" {
		status = string(StatusCanceled)
	}
	plan := parsePlanMetadata(stripeSub.Metadata[metadataPlanKey])
	if plan == "" {
		plan = stripeSub.plan()
	}
	var periodEnd time.Time
	if stripeSub.CurrentPeriodEnd > 0 {
		periodEnd = time.Unix(stripeSub.CurrentPeriodEnd, 0).UTC()
	}
	return s.Store.UpsertSubscription(ctx, Subscription{
		UserID:               userID,
		StripeCustomerID:     customerID,
		StripeSubscriptionID: stripeSub.ID,
		Status:               status,
		Plan:                 plan,
		CurrentPeriodEnd:     periodEnd,
		UpdatedAt:            s.now(),
	})
}

func eventObject(event Event) (json.RawMessage, error) {
	if len(event.Data) == 0 {
		return nil, fmt.Errorf("%w: empty data", ErrInvalidEvent)
	}
	var envelope struct {
		Object json.RawMessage `json:"object"`
	}
	if err := json.Unmarshal(event.Data, &envelope); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidEvent, err)
	}
	if len(envelope.Object) == 0 {
		return nil, fmt.Errorf("%w: missing object", ErrInvalidEvent)
	}
	return envelope.Object, nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func parseStripeID(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	var asString string
	if err := json.Unmarshal(raw, &asString); err == nil {
		return asString
	}
	var asObject struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(raw, &asObject); err == nil {
		return asObject.ID
	}
	return ""
}

type stripeCheckoutEvent struct {
	ID                string            `json:"id"`
	ClientReferenceID string            `json:"client_reference_id"`
	Customer          json.RawMessage   `json:"customer"`
	Subscription      json.RawMessage   `json:"subscription"`
	Metadata          map[string]string `json:"metadata"`
}

type stripeSubscriptionEvent struct {
	ID               string            `json:"id"`
	Status           string            `json:"status"`
	Customer         json.RawMessage   `json:"customer"`
	CurrentPeriodEnd int64             `json:"current_period_end"`
	Metadata         map[string]string `json:"metadata"`
	Items            struct {
		Data []struct {
			Price struct {
				ID        string     `json:"id"`
				LookupKey string     `json:"lookup_key"`
				Recurring *Recurring `json:"recurring"`
			} `json:"price"`
		} `json:"data"`
	} `json:"items"`
}

func (s stripeSubscriptionEvent) plan() Plan {
	if len(s.Items.Data) == 0 {
		return ""
	}
	price := s.Items.Data[0].Price
	interval := ""
	if price.Recurring != nil {
		interval = price.Recurring.Interval
	}
	return planFromLookupKey(price.LookupKey, interval)
}
