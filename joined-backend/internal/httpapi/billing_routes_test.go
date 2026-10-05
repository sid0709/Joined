package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/sid0709/OpenSeat/backend-core/billing"
)

func TestBillingRoutesStayUnmountedWithoutService(t *testing.T) {
	handler := New(nil, nil, nil, nil, nil, nil, Options{})
	req := httptest.NewRequest(http.MethodPost, billing.WebhookPath, strings.NewReader(`{}`))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("unmounted webhook status = %d, want 404", rec.Code)
	}
}

func TestBillingRoutesMountWithSessionUser(t *testing.T) {
	svc, webhook := testBilling(t)
	handler := New(nil, nil, nil, nil, nil, nil, Options{
		Sessions:       testSessions(),
		Billing:        svc,
		BillingWebhook: webhook,
	})

	t.Run("checkout requires a session", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/v1/me/billing/checkout", strings.NewReader(`{"plan":"monthly"}`))
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("employee cannot use hunter billing routes", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/me/billing/subscription", nil)
		req.Header.Set("Authorization", "Bearer employee-token")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusForbidden {
			t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("candidate can read subscription", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/me/billing/subscription", nil)
		req.Header.Set("Authorization", "Bearer candidate-token")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
		}
		var body map[string]any
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if body["premium"] != false {
			t.Fatalf("premium = %v, want false", body["premium"])
		}
	})

	t.Run("candidate can start checkout", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/v1/me/billing/checkout", strings.NewReader(
			`{"plan":"monthly","success_url":"https://app.example.test/ok","cancel_url":"https://app.example.test/no"}`,
		))
		req.Header.Set("Authorization", "Bearer candidate-token")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
		}
		var body map[string]string
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if body["url"] == "" {
			t.Fatalf("missing checkout url: %s", rec.Body.String())
		}
	})

	t.Run("candidate can start portal", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/v1/me/billing/portal", strings.NewReader(
			`{"return_url":"https://app.example.test/billing"}`,
		))
		req.Header.Set("Authorization", "Bearer candidate-token")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("stripe webhook is mounted without a session", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, billing.WebhookPath, strings.NewReader(`{"id":"evt_test"}`))
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code == http.StatusNotFound {
			t.Fatal("webhook 404ed")
		}
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d body = %s, want 401 for a missing signature", rec.Code, rec.Body.String())
		}
	})
}

func testBilling(t *testing.T) (*billing.Service, *billing.WebhookRouter) {
	t.Helper()
	client := billing.NewFakeClient()
	cfg := billing.Config{
		PremiumMonthlyPriceCents: 2900,
		PremiumYearlyPriceCents:  29000,
		CheckoutSuccessURL:       "https://app.example.test/billing/success",
		CheckoutCancelURL:        "https://app.example.test/billing/cancel",
		PortalReturnURL:          "https://app.example.test/billing",
		WebhookSecret:            "whsec_test",
	}
	if err := billing.SyncProducts(context.Background(), client, cfg); err != nil {
		t.Fatalf("SyncProducts: %v", err)
	}
	svc := billing.NewService(client, billing.NewMemoryStore(), cfg)
	return svc, billing.NewWebhookRouter(cfg.WebhookSecret, billing.NewMemoryIdempotencyStore())
}
