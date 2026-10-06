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
	// Acorn Pro matches the former website prices: $19/month, $15/month billed yearly.
	defaultAcornMonthlyPriceCents = 1900
	defaultAcornYearlyPriceCents  = 18000

	envStripeSecretKey       = "STRIPE_SECRET_KEY"
	envStripeWebhookSecret   = "STRIPE_WEBHOOK_SECRET"
	envStripeAllowLive       = "STRIPE_ALLOW_LIVE"
	envPremiumMonthlyPriceID = "STRIPE_PREMIUM_MONTHLY_PRICE_ID"
	envPremiumYearlyPriceID  = "STRIPE_PREMIUM_YEARLY_PRICE_ID"
	envAcornMonthlyPriceID   = "STRIPE_ACORN_MONTHLY_PRICE_ID"
	envAcornYearlyPriceID    = "STRIPE_ACORN_YEARLY_PRICE_ID"
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

	// AcornMonthlyPriceCents is the Acorn Pro monthly price in cents.
	AcornMonthlyPriceCents int
	// AcornYearlyPriceCents is the Acorn Pro yearly price in cents.
	AcornYearlyPriceCents int

	// CheckoutSuccessURL is the default Stripe Checkout success redirect.
	CheckoutSuccessURL string
	// CheckoutCancelURL is the default Stripe Checkout cancel redirect.
	CheckoutCancelURL string
	// PortalReturnURL is the default customer-portal return redirect.
	PortalReturnURL string

	// Optional Stripe price ids. Empty means checkout resolves the lookup key.
	PremiumMonthlyPriceID string
	PremiumYearlyPriceID  string
	AcornMonthlyPriceID   string
	AcornYearlyPriceID    string
}

// LoadConfig reads billing settings from the environment.
// Returns an error if STRIPE_SECRET_KEY is missing or if a live key is used without STRIPE_ALLOW_LIVE=true.
func LoadConfig() (Config, error) {
	premiumMonthly, err := optionalPriceID(envPremiumMonthlyPriceID)
	if err != nil {
		return Config{}, err
	}
	premiumYearly, err := optionalPriceID(envPremiumYearlyPriceID)
	if err != nil {
		return Config{}, err
	}
	acornMonthly, err := optionalPriceID(envAcornMonthlyPriceID)
	if err != nil {
		return Config{}, err
	}
	acornYearly, err := optionalPriceID(envAcornYearlyPriceID)
	if err != nil {
		return Config{}, err
	}
	cfg := Config{
		SecretKey:                strings.TrimSpace(os.Getenv(envStripeSecretKey)),
		WebhookSecret:            strings.TrimSpace(os.Getenv(envStripeWebhookSecret)),
		AllowLive:                envBool(envStripeAllowLive, false),
		PremiumMonthlyPriceCents: config.EnvInt("PREMIUM_MONTHLY_PRICE_CENTS", defaultPremiumMonthlyPriceCents),
		PremiumYearlyPriceCents:  config.EnvInt("PREMIUM_YEARLY_PRICE_CENTS", defaultPremiumYearlyPriceCents),
		AcornMonthlyPriceCents:   config.EnvInt("ACORN_MONTHLY_PRICE_CENTS", defaultAcornMonthlyPriceCents),
		AcornYearlyPriceCents:    config.EnvInt("ACORN_YEARLY_PRICE_CENTS", defaultAcornYearlyPriceCents),
		CheckoutSuccessURL:       config.Env("BILLING_CHECKOUT_SUCCESS_URL", ""),
		CheckoutCancelURL:        config.Env("BILLING_CHECKOUT_CANCEL_URL", ""),
		PortalReturnURL:          config.Env("BILLING_PORTAL_RETURN_URL", ""),
		PremiumMonthlyPriceID:    premiumMonthly,
		PremiumYearlyPriceID:     premiumYearly,
		AcornMonthlyPriceID:      acornMonthly,
		AcornYearlyPriceID:       acornYearly,
	}
	if cfg.SecretKey == "" {
		return Config{}, fmt.Errorf("%s is required", envStripeSecretKey)
	}
	if isLiveKey(cfg.SecretKey) && !cfg.AllowLive {
		return Config{}, fmt.Errorf("live key detected but %s is not true", envStripeAllowLive)
	}
	return cfg, nil
}

func optionalPriceID(key string) (string, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return "", nil
	}
	if !strings.HasPrefix(value, "price_") {
		return "", fmt.Errorf("%s must be a Stripe price id", key)
	}
	return value, nil
}

// CheckoutPriceID is the optional live price id for a product and plan.
// An empty string means checkout should resolve the lookup key.
func (c Config) CheckoutPriceID(product string, plan Plan) string {
	switch product {
	case "", ProductPremium, premiumProductLookupKey:
		switch plan {
		case PlanMonthly:
			return c.PremiumMonthlyPriceID
		case PlanYearly:
			return c.PremiumYearlyPriceID
		default:
			return ""
		}
	case ProductAcorn, acornProductLookupKey:
		switch plan {
		case PlanMonthly:
			return c.AcornMonthlyPriceID
		case PlanYearly:
			return c.AcornYearlyPriceID
		default:
			return ""
		}
	default:
		return ""
	}
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
