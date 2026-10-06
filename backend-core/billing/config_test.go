package billing

import (
	"os"
	"testing"
)

func TestLoadConfigRequiresSecretKey(t *testing.T) {
	unset(t, "STRIPE_SECRET_KEY")
	_, err := LoadConfig()
	if err == nil || err.Error() != "STRIPE_SECRET_KEY is required" {
		t.Fatalf("expected missing key error, got %v", err)
	}
}

func TestLoadConfigRefusesLiveKeyByDefault(t *testing.T) {
	setenv(t, "STRIPE_SECRET_KEY", "sk_live_123")
	unset(t, "STRIPE_ALLOW_LIVE")
	_, err := LoadConfig()
	if err == nil || err.Error() != "live key detected but STRIPE_ALLOW_LIVE is not true" {
		t.Fatalf("expected live key refusal, got %v", err)
	}
}

func TestLoadConfigRefusesRestrictedLiveKeyByDefault(t *testing.T) {
	setenv(t, "STRIPE_SECRET_KEY", "rk_live_123")
	unset(t, "STRIPE_ALLOW_LIVE")
	_, err := LoadConfig()
	if err == nil || err.Error() != "live key detected but STRIPE_ALLOW_LIVE is not true" {
		t.Fatalf("expected restricted live key refusal, got %v", err)
	}
}

func TestLoadConfigAcceptsLiveKeyWhenAllowed(t *testing.T) {
	setenv(t, "STRIPE_SECRET_KEY", "sk_live_123")
	setenv(t, "STRIPE_ALLOW_LIVE", "true")
	cfg, err := LoadConfig()
	if err != nil {
		t.Fatalf("expected success with live key allowed, got %v", err)
	}
	if cfg.SecretKey != "sk_live_123" || !cfg.AllowLive {
		t.Fatalf("expected live key accepted, got %+v", cfg)
	}
}

func TestLoadConfigAcceptsTestKey(t *testing.T) {
	setenv(t, "STRIPE_SECRET_KEY", "sk_test_xyz")
	unset(t, "STRIPE_ALLOW_LIVE")
	cfg, err := LoadConfig()
	if err != nil {
		t.Fatalf("expected success with test key, got %v", err)
	}
	if cfg.SecretKey != "sk_test_xyz" {
		t.Fatalf("expected test key, got %+v", cfg)
	}
}

func TestLoadConfigDefaultPrices(t *testing.T) {
	setenv(t, "STRIPE_SECRET_KEY", "sk_test_xyz")
	unset(t, "PREMIUM_MONTHLY_PRICE_CENTS")
	unset(t, "PREMIUM_YEARLY_PRICE_CENTS")
	unset(t, "ACORN_MONTHLY_PRICE_CENTS")
	unset(t, "ACORN_YEARLY_PRICE_CENTS")
	cfg, err := LoadConfig()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.PremiumMonthlyPriceCents != defaultPremiumMonthlyPriceCents {
		t.Fatalf("expected default monthly %d, got %d", defaultPremiumMonthlyPriceCents, cfg.PremiumMonthlyPriceCents)
	}
	if cfg.PremiumYearlyPriceCents != defaultPremiumYearlyPriceCents {
		t.Fatalf("expected default yearly %d, got %d", defaultPremiumYearlyPriceCents, cfg.PremiumYearlyPriceCents)
	}
}

func TestLoadConfigPriceIDOverrides(t *testing.T) {
	setenv(t, "STRIPE_SECRET_KEY", "sk_test_xyz")
	unset(t, "STRIPE_ALLOW_LIVE")
	setenv(t, "STRIPE_PREMIUM_MONTHLY_PRICE_ID", "price_premium_month")
	setenv(t, "STRIPE_PREMIUM_YEARLY_PRICE_ID", "price_premium_year")
	setenv(t, "STRIPE_ACORN_MONTHLY_PRICE_ID", "price_acorn_month")
	setenv(t, "STRIPE_ACORN_YEARLY_PRICE_ID", "price_acorn_year")
	cfg, err := LoadConfig()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.AllowLive {
		t.Fatal("live mode must stay off")
	}
	if cfg.PremiumMonthlyPriceID != "price_premium_month" || cfg.AcornYearlyPriceID != "price_acorn_year" {
		t.Fatalf("price ids = %+v", cfg)
	}
	if cfg.CheckoutPriceID(ProductPremium, PlanMonthly) != "price_premium_month" {
		t.Fatal("premium monthly override")
	}
	if cfg.CheckoutPriceID(ProductAcorn, PlanYearly) != "price_acorn_year" {
		t.Fatal("acorn yearly override")
	}

	setenv(t, "STRIPE_PREMIUM_MONTHLY_PRICE_ID", "not-a-price")
	if _, err := LoadConfig(); err == nil {
		t.Fatal("expected a price id error")
	}
}

func TestLoadConfigRedirectURLs(t *testing.T) {
	setenv(t, "STRIPE_SECRET_KEY", "sk_test_xyz")
	setenv(t, "BILLING_CHECKOUT_SUCCESS_URL", "https://app.example.test/ok")
	setenv(t, "BILLING_CHECKOUT_CANCEL_URL", "https://app.example.test/no")
	setenv(t, "BILLING_PORTAL_RETURN_URL", "https://app.example.test/billing")
	cfg, err := LoadConfig()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.CheckoutSuccessURL != "https://app.example.test/ok" {
		t.Fatalf("success url: %q", cfg.CheckoutSuccessURL)
	}
	if cfg.CheckoutCancelURL != "https://app.example.test/no" {
		t.Fatalf("cancel url: %q", cfg.CheckoutCancelURL)
	}
	if cfg.PortalReturnURL != "https://app.example.test/billing" {
		t.Fatalf("portal url: %q", cfg.PortalReturnURL)
	}
}

func TestLoadConfigCustomPrices(t *testing.T) {
	setenv(t, "STRIPE_SECRET_KEY", "sk_test_xyz")
	setenv(t, "PREMIUM_MONTHLY_PRICE_CENTS", "3500")
	setenv(t, "PREMIUM_YEARLY_PRICE_CENTS", "35000")
	cfg, err := LoadConfig()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.PremiumMonthlyPriceCents != 3500 {
		t.Fatalf("expected custom monthly 3500, got %d", cfg.PremiumMonthlyPriceCents)
	}
	if cfg.PremiumYearlyPriceCents != 35000 {
		t.Fatalf("expected custom yearly 35000, got %d", cfg.PremiumYearlyPriceCents)
	}
}

func setenv(t *testing.T, key, value string) {
	t.Helper()
	if err := os.Setenv(key, value); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Unsetenv(key) })
}

func unset(t *testing.T, key string) {
	t.Helper()
	if err := os.Unsetenv(key); err != nil {
		t.Fatal(err)
	}
}
