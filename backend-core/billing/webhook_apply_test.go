package billing

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestWebhookSubscriptionReplayChangesOnce(t *testing.T) {
	svc, _, store := testService(t)
	router := NewWebhookRouter("whsec_test123", NewMemoryIdempotencyStore())
	router.UseService(svc)

	periodEnd := time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC).Unix()
	payload := subscriptionEventPayload("evt_sub_1", EventSubscriptionCreated, "sub_1", "cus_1", "user_9", string(StatusActive), string(PlanMonthly), periodEnd)

	if code := sendSignedWebhook(t, router, "whsec_test123", payload); code != http.StatusOK {
		t.Fatalf("first delivery: %d", code)
	}
	if store.UpsertCount() != 1 {
		t.Fatalf("expected 1 upsert, got %d", store.UpsertCount())
	}
	if code := sendSignedWebhook(t, router, "whsec_test123", payload); code != http.StatusOK {
		t.Fatalf("replay: %d", code)
	}
	if store.UpsertCount() != 1 {
		t.Fatalf("replay should not write again, got %d upserts", store.UpsertCount())
	}

	sub, err := store.SubscriptionByUser(context.Background(), "user_9")
	if err != nil {
		t.Fatal(err)
	}
	if sub.Status != string(StatusActive) || sub.Plan != PlanMonthly || sub.StripeCustomerID != "cus_1" {
		t.Fatalf("unexpected subscription %+v", sub)
	}
	premium, err := svc.IsPremium(context.Background(), "user_9")
	if err != nil || !premium {
		t.Fatalf("expected premium after created, got %v %v", premium, err)
	}
}

func TestWebhookSubscriptionUpdatedAndDeleted(t *testing.T) {
	svc, _, store := testService(t)
	router := NewWebhookRouter("whsec_test123", NewMemoryIdempotencyStore())
	router.UseService(svc)
	periodEnd := time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC).Unix()

	created := subscriptionEventPayload("evt_sub_c", EventSubscriptionCreated, "sub_2", "cus_2", "user_10", string(StatusActive), string(PlanMonthly), periodEnd)
	if code := sendSignedWebhook(t, router, "whsec_test123", created); code != http.StatusOK {
		t.Fatalf("created: %d", code)
	}

	updated := subscriptionEventPayload("evt_sub_u", EventSubscriptionUpdated, "sub_2", "cus_2", "user_10", string(StatusActive), string(PlanYearly), periodEnd)
	if code := sendSignedWebhook(t, router, "whsec_test123", updated); code != http.StatusOK {
		t.Fatalf("updated: %d", code)
	}
	sub, err := store.SubscriptionByUser(context.Background(), "user_10")
	if err != nil {
		t.Fatal(err)
	}
	if sub.Plan != PlanYearly {
		t.Fatalf("expected yearly after update, got %s", sub.Plan)
	}

	deleted := subscriptionEventPayload("evt_sub_d", EventSubscriptionDeleted, "sub_2", "cus_2", "user_10", string(StatusCanceled), string(PlanYearly), time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC).Unix())
	if code := sendSignedWebhook(t, router, "whsec_test123", deleted); code != http.StatusOK {
		t.Fatalf("deleted: %d", code)
	}
	premium, err := svc.IsPremium(context.Background(), "user_10")
	if err != nil || premium {
		t.Fatalf("expected not premium after delete, got %v %v", premium, err)
	}
}

func TestWebhookCheckoutCompletedMapsCustomer(t *testing.T) {
	svc, _, store := testService(t)
	router := NewWebhookRouter("whsec_test123", NewMemoryIdempotencyStore())
	router.UseService(svc)

	payload := checkoutEventPayload("evt_cs_1", "cs_1", "cus_mapped", "sub_mapped", "user_11", string(PlanMonthly))
	if code := sendSignedWebhook(t, router, "whsec_test123", payload); code != http.StatusOK {
		t.Fatalf("checkout: %d", code)
	}
	if code := sendSignedWebhook(t, router, "whsec_test123", payload); code != http.StatusOK {
		t.Fatalf("checkout replay: %d", code)
	}
	if store.UpsertCount() != 1 {
		t.Fatalf("checkout replay should write once, got %d", store.UpsertCount())
	}
	customerID, err := store.CustomerID(context.Background(), "user_11")
	if err != nil || customerID != "cus_mapped" {
		t.Fatalf("expected mapped customer, got %s (%v)", customerID, err)
	}
	sub, err := store.SubscriptionByUser(context.Background(), "user_11")
	if err != nil {
		t.Fatal(err)
	}
	if sub.StripeSubscriptionID != "sub_mapped" || sub.Status != string(StatusActive) {
		t.Fatalf("unexpected checkout subscription %+v", sub)
	}
}

func TestWebhookExpandedCustomerObject(t *testing.T) {
	svc, _, store := testService(t)
	router := NewWebhookRouter("whsec_test123", NewMemoryIdempotencyStore())
	router.UseService(svc)
	payload := []byte(fmt.Sprintf(`{"id":"evt_exp","type":%q,"created":123,"data":{"object":{"id":"sub_exp","status":"active","customer":{"id":"cus_exp"},"current_period_end":1700000000,"metadata":{"joined_user_id":"user_exp"},"items":{"data":[{"price":{"lookup_key":%q,"recurring":{"interval":"month"}}}]}}}}`, EventSubscriptionCreated, monthlyPriceLookupKey))
	if code := sendSignedWebhook(t, router, "whsec_test123", payload); code != http.StatusOK {
		t.Fatalf("expanded customer: %d", code)
	}
	sub, err := store.SubscriptionByUser(context.Background(), "user_exp")
	if err != nil {
		t.Fatal(err)
	}
	if sub.StripeCustomerID != "cus_exp" || sub.Plan != PlanMonthly {
		t.Fatalf("unexpected sub %+v", sub)
	}
}

func sendSignedWebhook(t *testing.T, router *WebhookRouter, secret string, payload []byte) int {
	t.Helper()
	timestamp := time.Now().Unix()
	sig := computeSignature(secret, timestamp, payload)
	header := fmt.Sprintf("t=%d,v1=%s", timestamp, sig)
	req := httptest.NewRequest("POST", WebhookPath, bytes.NewReader(payload))
	req.Header.Set("Stripe-Signature", header)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	return rr.Code
}

func subscriptionEventPayload(eventID, eventType, subID, customerID, userID, status, plan string, periodEnd int64) []byte {
	lookup := monthlyPriceLookupKey
	interval := "month"
	if plan == string(PlanYearly) {
		lookup = yearlyPriceLookupKey
		interval = "year"
	}
	payload := map[string]any{
		"id":      eventID,
		"type":    eventType,
		"created": 1234567890,
		"data": map[string]any{
			"object": map[string]any{
				"id":                 subID,
				"status":             status,
				"customer":           customerID,
				"current_period_end": periodEnd,
				"metadata": map[string]string{
					metadataUserIDKey: userID,
					metadataPlanKey:   plan,
				},
				"items": map[string]any{
					"data": []map[string]any{
						{"price": map[string]any{
							"lookup_key": lookup,
							"recurring":  map[string]any{"interval": interval, "interval_count": 1},
						}},
					},
				},
			},
		},
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		panic(err)
	}
	return raw
}

func checkoutEventPayload(eventID, sessionID, customerID, subscriptionID, userID, plan string) []byte {
	payload := map[string]any{
		"id":      eventID,
		"type":    EventCheckoutSessionCompleted,
		"created": 1234567890,
		"data": map[string]any{
			"object": map[string]any{
				"id":                  sessionID,
				"client_reference_id": userID,
				"customer":            customerID,
				"subscription":        subscriptionID,
				"metadata": map[string]string{
					metadataUserIDKey: userID,
					metadataPlanKey:   plan,
				},
			},
		},
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		panic(err)
	}
	return raw
}
