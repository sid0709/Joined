package billing

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHandlersCheckoutPortalAndStatus(t *testing.T) {
	svc, _, _ := testService(t)
	mux := http.NewServeMux()
	Handlers{
		Service: svc,
		CurrentUser: func(r *http.Request) (string, string, error) {
			return "user_http", "http@example.test", nil
		},
	}.Register(mux)

	checkoutBody, _ := json.Marshal(checkoutRequestBody{
		Plan:       string(PlanMonthly),
		SuccessURL: "https://app.example.test/ok",
		CancelURL:  "https://app.example.test/no",
	})
	req := httptest.NewRequest("POST", "/v1/me/billing/checkout", bytes.NewReader(checkoutBody))
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("checkout: %d %s", rr.Code, rr.Body.String())
	}
	var created sessionURLResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &created); err != nil || created.URL == "" {
		t.Fatalf("checkout body: %s", rr.Body.String())
	}

	portalReq := httptest.NewRequest("POST", "/v1/me/billing/portal", bytes.NewReader([]byte(`{"return_url":"https://app.example.test/billing"}`)))
	portalRR := httptest.NewRecorder()
	mux.ServeHTTP(portalRR, portalReq)
	if portalRR.Code != http.StatusOK {
		t.Fatalf("portal: %d %s", portalRR.Code, portalRR.Body.String())
	}

	statusReq := httptest.NewRequest("GET", "/v1/me/billing/subscription", nil)
	statusRR := httptest.NewRecorder()
	mux.ServeHTTP(statusRR, statusReq)
	if statusRR.Code != http.StatusOK {
		t.Fatalf("status: %d %s", statusRR.Code, statusRR.Body.String())
	}
	var status subscriptionResponse
	if err := json.Unmarshal(statusRR.Body.Bytes(), &status); err != nil {
		t.Fatal(err)
	}
	if status.Premium {
		t.Fatal("expected not premium before webhook")
	}
}

func TestHandlersUnauthorized(t *testing.T) {
	svc, _, _ := testService(t)
	mux := http.NewServeMux()
	Handlers{
		Service: svc,
		CurrentUser: func(r *http.Request) (string, string, error) {
			return "", "", ErrUnauthorized
		},
	}.Register(mux)
	req := httptest.NewRequest("POST", "/v1/me/billing/checkout", bytes.NewReader([]byte(`{"plan":"monthly"}`)))
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rr.Code)
	}
}
