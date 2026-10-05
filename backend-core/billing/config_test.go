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
