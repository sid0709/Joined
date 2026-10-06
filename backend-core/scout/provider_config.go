package scout

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
)

// Payout provider names and sandbox hosts. Live hosts need PAYOUT_ALLOW_LIVE.
const (
	PayoutProviderFake   = "fake"
	PayoutProviderWise   = "wise"
	PayoutProviderPayPal = "paypal"

	envPayoutProvider      = "PAYOUT_PROVIDER"
	envPayoutAPIToken      = "PAYOUT_API_TOKEN"
	envPayoutWebhookSecret = "PAYOUT_WEBHOOK_SECRET"
	envPayoutAllowLive     = "PAYOUT_ALLOW_LIVE"
	envPayoutAPIBaseURL    = "PAYOUT_API_BASE_URL"

	wiseSandboxBaseURL   = "https://api.sandbox.transferwise.tech"
	wiseLiveHost         = "api.transferwise.com"
	paypalSandboxBaseURL = "https://api-m.sandbox.paypal.com"
	paypalLiveHost       = "api-m.paypal.com"
)

var livePayoutHosts = []string{wiseLiveHost, paypalLiveHost}

// PayoutConfig is the rail settings. Default is the in-memory fake.
type PayoutConfig struct {
	Provider      string
	APIToken      string
	WebhookSecret string
	AllowLive     bool
	BaseURL       string
}

// LoadPayoutConfig reads payout rail settings from the environment.
// Fake needs no credentials. Live hosts or live-looking tokens need PAYOUT_ALLOW_LIVE=true.
func LoadPayoutConfig() (PayoutConfig, error) {
	cfg := PayoutConfig{
		Provider:      strings.ToLower(strings.TrimSpace(os.Getenv(envPayoutProvider))),
		APIToken:      strings.TrimSpace(os.Getenv(envPayoutAPIToken)),
		WebhookSecret: strings.TrimSpace(os.Getenv(envPayoutWebhookSecret)),
		AllowLive:     envBool(envPayoutAllowLive, false),
		BaseURL:       strings.TrimSpace(os.Getenv(envPayoutAPIBaseURL)),
	}
	if cfg.Provider == "" {
		cfg.Provider = PayoutProviderFake
	}
	switch cfg.Provider {
	case PayoutProviderFake, PayoutProviderWise, PayoutProviderPayPal:
	default:
		return PayoutConfig{}, fmt.Errorf("unknown %s %q (use fake, wise, or paypal)", envPayoutProvider, cfg.Provider)
	}
	if cfg.BaseURL == "" {
		cfg.BaseURL = defaultPayoutBaseURL(cfg.Provider)
	}
	if cfg.Provider != PayoutProviderFake && cfg.APIToken == "" {
		return PayoutConfig{}, fmt.Errorf("%s is required", envPayoutAPIToken)
	}
	if isLivePayoutSetup(cfg.BaseURL, cfg.APIToken) && !cfg.AllowLive {
		return PayoutConfig{}, fmt.Errorf("live payout credential detected but %s is not true", envPayoutAllowLive)
	}
	return cfg, nil
}

// NewProvider builds the rail for cfg. Fake is used when Provider is fake or empty.
func NewProvider(cfg PayoutConfig) (Provider, error) {
	switch cfg.Provider {
	case "", PayoutProviderFake:
		return NewFakeProvider(), nil
	case PayoutProviderWise, PayoutProviderPayPal:
		return NewHTTPProvider(cfg.Provider, cfg.APIToken, cfg.BaseURL), nil
	default:
		return nil, fmt.Errorf("unknown payout provider %q", cfg.Provider)
	}
}

func defaultPayoutBaseURL(provider string) string {
	switch provider {
	case PayoutProviderWise:
		return wiseSandboxBaseURL
	case PayoutProviderPayPal:
		return paypalSandboxBaseURL
	default:
		return ""
	}
}

func isLivePayoutSetup(baseURL, token string) bool {
	return isLivePayoutHost(baseURL) || isLivePayoutToken(token)
}

func isLivePayoutHost(baseURL string) bool {
	parsed, err := url.Parse(baseURL)
	if err != nil {
		return false
	}
	host := strings.ToLower(parsed.Hostname())
	for _, live := range livePayoutHosts {
		if host == live {
			return true
		}
	}
	return false
}

func isLivePayoutToken(token string) bool {
	value := strings.ToLower(strings.TrimSpace(token))
	return strings.HasPrefix(value, "live_") || strings.Contains(value, "_live_") || strings.HasPrefix(value, "sk_live_")
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
