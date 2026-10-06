package billing

import (
	"context"
	"errors"
	"testing"
)

func testService(t *testing.T) (*Service, *FakeClient, *MemoryStore) {
	t.Helper()
	client := NewFakeClient()
	store := NewMemoryStore()
	cfg := Config{
		PremiumMonthlyPriceCents: 2900,
		PremiumYearlyPriceCents:  29000,
		CheckoutSuccessURL:       "https://app.example.test/billing/success",
		CheckoutCancelURL:        "https://app.example.test/billing/cancel",
		PortalReturnURL:          "https://app.example.test/billing",
	}
	if err := SyncProducts(context.Background(), client, cfg); err != nil {
		t.Fatalf("SyncProducts: %v", err)
	}
	return NewService(client, store, cfg), client, store
}

func TestCreateCheckoutSessionMonthlyAndYearly(t *testing.T) {
	svc, _, store := testService(t)
	monthly, err := svc.CreateCheckoutSession(context.Background(), CheckoutParams{
		UserID: "user_1",
		Email:  "user@example.test",
		Plan:   string(PlanMonthly),
	})
	if err != nil {
		t.Fatalf("monthly checkout: %v", err)
	}
	if monthly.URL == "" || monthly.CustomerID == "" {
		t.Fatalf("expected checkout url and customer, got %+v", monthly)
	}
	customerID, err := store.CustomerID(context.Background(), "user_1")
	if err != nil || customerID != monthly.CustomerID {
		t.Fatalf("expected mapped customer %s, got %s (%v)", monthly.CustomerID, customerID, err)
	}

	yearly, err := svc.CreateCheckoutSession(context.Background(), CheckoutParams{
		UserID: "user_1",
		Email:  "user@example.test",
		Plan:   string(PlanYearly),
	})
	if err != nil {
		t.Fatalf("yearly checkout: %v", err)
	}
	if yearly.CustomerID != monthly.CustomerID {
		t.Fatalf("expected same customer, got %s then %s", monthly.CustomerID, yearly.CustomerID)
	}
	if yearly.ID == monthly.ID || yearly.URL == "" {
		t.Fatalf("expected a second checkout session, got %+v", yearly)
	}
}

func TestCreateCheckoutSessionUsesPriceIDOverride(t *testing.T) {
	svc, client, _ := testService(t)
	const priceID = "price_override_monthly"
	client.PutPrice(&Price{ID: priceID, Active: true})
	svc.Config.PremiumMonthlyPriceID = priceID
	session, err := svc.CreateCheckoutSession(context.Background(), CheckoutParams{
		UserID: "user_override",
		Email:  "user@example.test",
		Plan:   string(PlanMonthly),
	})
	if err != nil {
		t.Fatal(err)
	}
	if session.URL == "" {
		t.Fatal("expected a checkout url")
	}
}

func TestCreateCheckoutSessionRejectsInvalidPlan(t *testing.T) {
	svc, _, _ := testService(t)
	_, err := svc.CreateCheckoutSession(context.Background(), CheckoutParams{
		UserID: "user_1",
		Plan:   "weekly",
	})
	if !errors.Is(err, ErrInvalidPlan) {
		t.Fatalf("expected ErrInvalidPlan, got %v", err)
	}
}

func TestCreateCheckoutSessionRejectsInvalidURL(t *testing.T) {
	svc, _, _ := testService(t)
	svc.Config.CheckoutSuccessURL = ""
	svc.Config.CheckoutCancelURL = ""
	_, err := svc.CreateCheckoutSession(context.Background(), CheckoutParams{
		UserID:     "user_1",
		Plan:       string(PlanMonthly),
		SuccessURL: "javascript:alert(1)",
		CancelURL:  "https://app.example.test/cancel",
	})
	if !errors.Is(err, ErrInvalidURL) {
		t.Fatalf("expected ErrInvalidURL, got %v", err)
	}
}

func TestEnsureCustomerIsIdempotent(t *testing.T) {
	svc, client, _ := testService(t)
	first, err := svc.EnsureCustomer(context.Background(), "user_2", "a@example.test")
	if err != nil {
		t.Fatal(err)
	}
	second, err := svc.EnsureCustomer(context.Background(), "user_2", "a@example.test")
	if err != nil {
		t.Fatal(err)
	}
	if first != second {
		t.Fatalf("expected same customer, got %s then %s", first, second)
	}
	if len(client.customers) != 1 {
		t.Fatalf("expected 1 stripe customer, got %d", len(client.customers))
	}
}

func TestCreatePortalSession(t *testing.T) {
	svc, _, _ := testService(t)
	if _, err := svc.CreatePortalSession(context.Background(), PortalParams{UserID: "user_3"}); !errors.Is(err, ErrNoCustomer) {
		t.Fatalf("expected ErrNoCustomer, got %v", err)
	}
	if _, err := svc.EnsureCustomer(context.Background(), "user_3", "c@example.test"); err != nil {
		t.Fatal(err)
	}
	session, err := svc.CreatePortalSession(context.Background(), PortalParams{UserID: "user_3"})
	if err != nil {
		t.Fatalf("portal: %v", err)
	}
	if session.URL == "" {
		t.Fatal("expected portal url")
	}
}
