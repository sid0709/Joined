package billing

import (
	"context"
	"testing"
	"time"
)

func TestSyncAcornProductsIsIdempotent(t *testing.T) {
	client := NewFakeClient()
	cfg := Config{AcornMonthlyPriceCents: 1900, AcornYearlyPriceCents: 18000}
	if err := SyncProducts(context.Background(), client, cfg); err != nil {
		t.Fatal(err)
	}
	if err := SyncProducts(context.Background(), client, cfg); err != nil {
		t.Fatal(err)
	}
	products, err := client.ListProducts(context.Background(), acornProductLookupKey)
	if err != nil || len(products) != 1 {
		t.Fatalf("acorn products = %d (%v)", len(products), err)
	}
	prices, err := client.ListPrices(context.Background(), products[0].ID)
	if err != nil {
		t.Fatal(err)
	}
	active := 0
	for _, price := range prices {
		if !price.Active {
			continue
		}
		active++
		switch price.LookupKey {
		case acornMonthlyPriceLookupKey:
			if price.UnitAmount != 1900 {
				t.Fatalf("monthly = %+v", price)
			}
		case acornYearlyPriceLookupKey:
			if price.UnitAmount != 18000 {
				t.Fatalf("yearly = %+v", price)
			}
		default:
			t.Fatalf("unexpected active price %+v", price)
		}
	}
	if active != 2 {
		t.Fatalf("active prices = %d", active)
	}
}

func TestAcornCheckoutDoesNotGrantJoinedPremium(t *testing.T) {
	client := NewFakeClient()
	store := NewMemoryStore()
	cfg := Config{
		AcornMonthlyPriceCents: 1900,
		AcornYearlyPriceCents:  18000,
		CheckoutSuccessURL:     "https://acorn.example.test/billing/success",
		CheckoutCancelURL:      "https://acorn.example.test/billing/cancel",
	}
	if err := SyncProducts(context.Background(), client, cfg); err != nil {
		t.Fatal(err)
	}
	svc := NewService(client, store, cfg)
	session, err := svc.CreateCheckoutSession(context.Background(), CheckoutParams{
		UserID:  "acorn_user",
		Email:   "a@example.test",
		Plan:    string(PlanMonthly),
		Product: ProductAcorn,
	})
	if err != nil {
		t.Fatal(err)
	}
	if session.URL == "" {
		t.Fatal("expected checkout url")
	}
	now := time.Date(2026, 10, 6, 0, 0, 0, 0, time.UTC)
	svc.Now = func() time.Time { return now }
	err = svc.ApplyCheckoutCompleted(context.Background(), Event{
		Type: EventCheckoutSessionCompleted,
		Data: []byte(`{"object":{"id":"cs_acorn","client_reference_id":"acorn_user","customer":"cus_acorn","subscription":"sub_acorn","metadata":{"joined_user_id":"acorn_user","plan":"monthly","product":"acorn_pro"}}}`),
	})
	if err != nil {
		t.Fatal(err)
	}
	premium, err := svc.IsPremium(context.Background(), "acorn_user")
	if err != nil || premium {
		t.Fatalf("acorn checkout granted premium: %v %v", premium, err)
	}
	sub, err := store.SubscriptionByUser(context.Background(), "acorn_user")
	if err != nil || sub.Product != acornProductLookupKey {
		t.Fatalf("stored product = %#v err=%v", sub, err)
	}
}

func TestLoadConfigAcornPriceDefaults(t *testing.T) {
	setenv(t, "STRIPE_SECRET_KEY", "sk_test_xyz")
	unset(t, "ACORN_MONTHLY_PRICE_CENTS")
	unset(t, "ACORN_YEARLY_PRICE_CENTS")
	cfg, err := LoadConfig()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.AcornMonthlyPriceCents != defaultAcornMonthlyPriceCents || cfg.AcornYearlyPriceCents != defaultAcornYearlyPriceCents {
		t.Fatalf("acorn defaults = %d %d", cfg.AcornMonthlyPriceCents, cfg.AcornYearlyPriceCents)
	}
}
