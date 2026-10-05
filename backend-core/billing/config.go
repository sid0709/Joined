// Package billing manages Stripe subscriptions for Joined Premium.
// Uses test mode by default; live keys require STRIPE_ALLOW_LIVE=true.
package billing

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/sid0709/OpenSeat/backend-core/config"
)

const (
	defaultPremiumMonthlyPriceCents = 2900
	defaultPremiumYearlyPriceCents  = 29000
)

// Config holds Stripe settings: secret key, webhook secret, and Premium pricing.
type Config struct {
	// SecretKey is the Stripe API key (sk_test_... or sk_live_...).
	SecretKey string
	// WebhookSecret verifies webhook signatures.
	WebhookSecret string
	// AllowLive permits live keys when true. Test keys always work.
	AllowLive bool

	// PremiumMonthlyPriceCents is the monthly Premium subscription price in cents.
	PremiumMonthlyPriceCents int
	// PremiumYearlyPriceCents is the yearly Premium subscription price in cents.
	PremiumYearlyPriceCents int

	// CheckoutSuccessURL is the default Stripe Checkout success redirect.
	CheckoutSuccessURL string
	// CheckoutCancelURL is the default Stripe Checkout cancel redirect.
	CheckoutCancelURL string
	// PortalReturnURL is the default customer-portal return redirect.
	PortalReturnURL string
}

// LoadConfig reads billing settings from the environment.
// Returns an error if STRIPE_SECRET_KEY is missing or if a live key is used without STRIPE_ALLOW_LIVE=true.
func LoadConfig() (Config, error) {
	cfg := Config{
		SecretKey:                strings.TrimSpace(os.Getenv("STRIPE_SECRET_KEY")),
		WebhookSecret:            strings.TrimSpace(os.Getenv("STRIPE_WEBHOOK_SECRET")),
		AllowLive:                envBool("STRIPE_ALLOW_LIVE", false),
		PremiumMonthlyPriceCents: config.EnvInt("PREMIUM_MONTHLY_PRICE_CENTS", defaultPremiumMonthlyPriceCents),
		PremiumYearlyPriceCents:  config.EnvInt("PREMIUM_YEARLY_PRICE_CENTS", defaultPremiumYearlyPriceCents),
		CheckoutSuccessURL:       config.Env("BILLING_CHECKOUT_SUCCESS_URL", ""),
		CheckoutCancelURL:        config.Env("BILLING_CHECKOUT_CANCEL_URL", ""),
		PortalReturnURL:          config.Env("BILLING_PORTAL_RETURN_URL", ""),
	}
	if cfg.SecretKey == "" {
		return Config{}, fmt.Errorf("STRIPE_SECRET_KEY is required")
	}
	if isLiveKey(cfg.SecretKey) && !cfg.AllowLive {
		return Config{}, fmt.Errorf("live key detected but STRIPE_ALLOW_LIVE is not true")
	}
	return cfg, nil
}

func isLiveKey(key string) bool {
	return strings.HasPrefix(key, "sk_live_") || strings.HasPrefix(key, "rk_live_")
}

func envBool(key string, fallback bool) bool {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}
