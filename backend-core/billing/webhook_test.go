package billing

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestWebhookRouterVerifiesSignature(t *testing.T) {
	secret := "whsec_test123"
	store := NewMemoryIdempotencyStore()
	router := NewWebhookRouter(secret, store)

	payload := []byte(`{"id":"evt_1","type":"checkout.session.completed","created":1234567890,"data":{}}`)
	timestamp := time.Now().Unix()
	sig := computeSignature(secret, timestamp, payload)
	header := fmt.Sprintf("t=%d,v1=%s", timestamp, sig)

	req := httptest.NewRequest("POST", "/webhook", bytes.NewReader(payload))
	req.Header.Set("Stripe-Signature", header)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestWebhookRouterRejectsInvalidSignature(t *testing.T) {
	store := NewMemoryIdempotencyStore()
	router := NewWebhookRouter("whsec_test123", store)

	payload := []byte(`{"id":"evt_2","type":"checkout.session.completed","created":1234567890,"data":{}}`)
	timestamp := time.Now().Unix()
	header := fmt.Sprintf("t=%d,v1=badsignature", timestamp)

	req := httptest.NewRequest("POST", "/webhook", bytes.NewReader(payload))
	req.Header.Set("Stripe-Signature", header)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rr.Code)
	}
}

func TestWebhookRouterRejectsOldTimestamp(t *testing.T) {
	secret := "whsec_test123"
	store := NewMemoryIdempotencyStore()
	router := NewWebhookRouter(secret, store)

	payload := []byte(`{"id":"evt_3","type":"checkout.session.completed","created":1234567890,"data":{}}`)
	timestamp := time.Now().Unix() - 400
	sig := computeSignature(secret, timestamp, payload)
	header := fmt.Sprintf("t=%d,v1=%s", timestamp, sig)

	req := httptest.NewRequest("POST", "/webhook", bytes.NewReader(payload))
	req.Header.Set("Stripe-Signature", header)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for old timestamp, got %d", rr.Code)
	}
}

func TestWebhookRouterIdempotency(t *testing.T) {
	secret := "whsec_test123"
	store := NewMemoryIdempotencyStore()
	router := NewWebhookRouter(secret, store)

	payload := []byte(`{"id":"evt_4","type":"checkout.session.completed","created":1234567890,"data":{}}`)
	sendWebhook := func() int {
		timestamp := time.Now().Unix()
		sig := computeSignature(secret, timestamp, payload)
		header := fmt.Sprintf("t=%d,v1=%s", timestamp, sig)
		req := httptest.NewRequest("POST", "/webhook", bytes.NewReader(payload))
		req.Header.Set("Stripe-Signature", header)
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)
		return rr.Code
	}

	if code := sendWebhook(); code != http.StatusOK {
		t.Fatalf("first request failed: %d", code)
	}
	if code := sendWebhook(); code != http.StatusOK {
		t.Fatalf("duplicate request should succeed but not reprocess: %d", code)
	}
}

func TestWebhookRouterUnknownEventType(t *testing.T) {
	secret := "whsec_test123"
	store := NewMemoryIdempotencyStore()
	router := NewWebhookRouter(secret, store)

	payload := []byte(`{"id":"evt_5","type":"unknown.event","created":1234567890,"data":{}}`)
	timestamp := time.Now().Unix()
	sig := computeSignature(secret, timestamp, payload)
	header := fmt.Sprintf("t=%d,v1=%s", timestamp, sig)

	req := httptest.NewRequest("POST", "/webhook", bytes.NewReader(payload))
	req.Header.Set("Stripe-Signature", header)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 for unknown event, got %d", rr.Code)
	}
}

func computeSignature(secret string, timestamp int64, payload []byte) string {
	signedPayload := fmt.Sprintf("%d.%s", timestamp, payload)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(signedPayload))
	return hex.EncodeToString(mac.Sum(nil))
}
