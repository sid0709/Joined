package scout

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestPayoutWebhookVerifiesSignature(t *testing.T) {
	store, fake := payoutReadyStore(t)
	payout := requestReadyPayout(t, store)
	if _, err := store.DecidePayout(contextBG(), payout.ID, "staff-1", PayoutDecision{Decision: PayoutDecisionPaid}); err != nil {
		t.Fatal(err)
	}
	updated, err := store.payout(contextBG(), payout.ID)
	if err != nil {
		t.Fatal(err)
	}
	if updated.ProviderRef == "" {
		t.Fatal("expected provider ref after approval")
	}
	fake.SetStatus(updated.ProviderRef, ProviderStatusPaid)

	secret := "whsec_payout_test"
	handler := NewPayoutWebhook(store, secret)
	event, _ := json.Marshal(ProviderEvent{
		ID:          "evt_1",
		PayoutID:    payout.ID,
		ProviderRef: updated.ProviderRef,
		Status:      ProviderStatusPaid,
	})
	req := httptest.NewRequest(http.MethodPost, PayoutWebhookPath, bytes.NewReader(event))
	req.Header.Set(payoutSignatureHeader, SignPayoutPayload(secret, event, time.Now()))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
	}
	paid, err := store.payout(contextBG(), payout.ID)
	if err != nil {
		t.Fatal(err)
	}
	if paid.Status != PayoutPaid {
		t.Fatalf("status = %q, want paid", paid.Status)
	}

	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, signedPayoutRequest(secret, event))
	if rec.Code != http.StatusOK {
		t.Fatalf("replay status = %d", rec.Code)
	}
}

func TestPayoutWebhookRejectsBadSignature(t *testing.T) {
	store, _ := payoutReadyStore(t)
	handler := NewPayoutWebhook(store, "whsec_payout_test")
	event := []byte(`{"id":"evt_bad","status":"paid"}`)
	req := httptest.NewRequest(http.MethodPost, PayoutWebhookPath, bytes.NewReader(event))
	req.Header.Set(payoutSignatureHeader, "t=1,v1=deadbeef")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

func TestRefreshPayoutFromProvider(t *testing.T) {
	store, fake := payoutReadyStore(t)
	payout := requestReadyPayout(t, store)
	sent, err := store.DecidePayout(contextBG(), payout.ID, "staff-1", PayoutDecision{Decision: PayoutDecisionApprove})
	if err != nil {
		t.Fatal(err)
	}
	fake.SetStatus(sent.ProviderRef, ProviderStatusFailed)
	failed, err := store.RefreshPayoutFromProvider(contextBG(), sent.ID)
	if err != nil {
		t.Fatal(err)
	}
	if failed.Status != PayoutFailed {
		t.Fatalf("status = %q", failed.Status)
	}
	balance, err := store.Balance(contextBG(), "scout-1")
	if err != nil {
		t.Fatal(err)
	}
	if balance.Released.AmountCents != MinPayoutCents || balance.Processing.AmountCents != 0 {
		t.Fatalf("balance = %+v", balance)
	}
}

func signedPayoutRequest(secret string, payload []byte) *http.Request {
	req := httptest.NewRequest(http.MethodPost, PayoutWebhookPath, bytes.NewReader(payload))
	req.Header.Set(payoutSignatureHeader, SignPayoutPayload(secret, payload, time.Now()))
	return req
}
