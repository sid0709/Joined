package scout

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHTTPProviderSendUsesPayoutIDAsIdempotencyKey(t *testing.T) {
	var gotHeader, gotPath string
	var body []byte
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotHeader = r.Header.Get(wiseIdempotencyHeader)
		gotPath = r.URL.Path
		body, _ = io.ReadAll(r.Body)
		w.Header().Set("Content-Type", payoutJSONContentType)
		_ = json.NewEncoder(w).Encode(httpIDResponse{ID: "tr_99", Status: ProviderStatusSent})
	}))
	t.Cleanup(server.Close)

	provider := NewHTTPProvider(PayoutProviderWise, "sandbox_token", server.URL)
	result, err := provider.SendPayout(context.Background(), Transfer{
		PayoutID:    "payout-1",
		RecipientID: "rcp_1",
		AmountCents: 2500,
		Currency:    Currency,
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.ProviderRef != "tr_99" || result.Status != ProviderStatusSent {
		t.Fatalf("result = %+v", result)
	}
	if gotHeader != "payout-1" {
		t.Fatalf("idempotency header = %q", gotHeader)
	}
	if gotPath != payoutSendPath {
		t.Fatalf("path = %q", gotPath)
	}
	if len(body) == 0 {
		t.Fatal("expected request body")
	}
}

func TestHTTPProviderCreateAndGet(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", payoutJSONContentType)
		switch {
		case r.Method == http.MethodPost && r.URL.Path == payoutRecipientPath:
			_ = json.NewEncoder(w).Encode(httpIDResponse{ID: "rcp_http"})
		case r.Method == http.MethodGet && r.URL.Path == payoutSendPath+"/tr_http":
			_ = json.NewEncoder(w).Encode(httpIDResponse{ID: "tr_http", Status: "completed"})
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(server.Close)

	provider := NewHTTPProvider(PayoutProviderPayPal, "sandbox_token", server.URL)
	created, err := provider.CreateRecipient(context.Background(), Recipient{Email: "ada@example.com", Country: "US", Currency: Currency})
	if err != nil {
		t.Fatal(err)
	}
	if created.RecipientID != "rcp_http" {
		t.Fatalf("recipient = %+v", created)
	}
	got, err := provider.GetPayout(context.Background(), "tr_http")
	if err != nil {
		t.Fatal(err)
	}
	if got.Status != ProviderStatusPaid {
		t.Fatalf("status = %q", got.Status)
	}
}

func TestPayPalIdempotencyHeader(t *testing.T) {
	provider := NewHTTPProvider(PayoutProviderPayPal, "sandbox_token", paypalSandboxBaseURL)
	if got := provider.idempotencyHeader(); got != paypalIdempotencyHeader {
		t.Fatalf("header = %q", got)
	}
}
