package scout

import (
	"os"
	"testing"
)

func TestLoadPayoutConfigDefaultsToFake(t *testing.T) {
	t.Setenv(envPayoutProvider, "")
	t.Setenv(envPayoutAPIToken, "")
	t.Setenv(envPayoutAllowLive, "")
	t.Setenv(envPayoutAPIBaseURL, "")
	cfg, err := LoadPayoutConfig()
	if err != nil {
		t.Fatalf("LoadPayoutConfig: %v", err)
	}
	if cfg.Provider != PayoutProviderFake {
		t.Fatalf("provider = %q, want fake", cfg.Provider)
	}
}

func TestLoadPayoutConfigRefusesLiveHost(t *testing.T) {
	t.Setenv(envPayoutProvider, PayoutProviderWise)
	t.Setenv(envPayoutAPIToken, "sandbox_token")
	t.Setenv(envPayoutAPIBaseURL, "https://"+wiseLiveHost)
	if err := os.Unsetenv(envPayoutAllowLive); err != nil {
		t.Fatal(err)
	}
	_, err := LoadPayoutConfig()
	if err == nil || err.Error() != "live payout credential detected but PAYOUT_ALLOW_LIVE is not true" {
		t.Fatalf("expected live refusal, got %v", err)
	}
}

func TestLoadPayoutConfigRefusesLiveToken(t *testing.T) {
	t.Setenv(envPayoutProvider, PayoutProviderPayPal)
	t.Setenv(envPayoutAPIToken, "live_secret")
	t.Setenv(envPayoutAPIBaseURL, paypalSandboxBaseURL)
	if err := os.Unsetenv(envPayoutAllowLive); err != nil {
		t.Fatal(err)
	}
	_, err := LoadPayoutConfig()
	if err == nil || err.Error() != "live payout credential detected but PAYOUT_ALLOW_LIVE is not true" {
		t.Fatalf("expected live token refusal, got %v", err)
	}
}

func TestLoadPayoutConfigAcceptsLiveWhenAllowed(t *testing.T) {
	t.Setenv(envPayoutProvider, PayoutProviderWise)
	t.Setenv(envPayoutAPIToken, "live_secret")
	t.Setenv(envPayoutAPIBaseURL, "https://"+wiseLiveHost)
	t.Setenv(envPayoutAllowLive, "true")
	cfg, err := LoadPayoutConfig()
	if err != nil {
		t.Fatalf("LoadPayoutConfig: %v", err)
	}
	if !cfg.AllowLive || cfg.APIToken != "live_secret" {
		t.Fatalf("cfg = %+v", cfg)
	}
}

func TestLoadPayoutConfigRequiresTokenForWise(t *testing.T) {
	t.Setenv(envPayoutProvider, PayoutProviderWise)
	t.Setenv(envPayoutAPIToken, "")
	t.Setenv(envPayoutAPIBaseURL, "")
	_, err := LoadPayoutConfig()
	if err == nil || err.Error() != "PAYOUT_API_TOKEN is required" {
		t.Fatalf("expected token required, got %v", err)
	}
}

func TestLoadPayoutConfigSandboxWise(t *testing.T) {
	t.Setenv(envPayoutProvider, PayoutProviderWise)
	t.Setenv(envPayoutAPIToken, "sandbox_token")
	t.Setenv(envPayoutAPIBaseURL, "")
	if err := os.Unsetenv(envPayoutAllowLive); err != nil {
		t.Fatal(err)
	}
	cfg, err := LoadPayoutConfig()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.BaseURL != wiseSandboxBaseURL {
		t.Fatalf("base URL = %q", cfg.BaseURL)
	}
}

func TestNewProviderFakeAndHTTP(t *testing.T) {
	fake, err := NewProvider(PayoutConfig{Provider: PayoutProviderFake})
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := fake.(*FakeProvider); !ok {
		t.Fatalf("got %T, want *FakeProvider", fake)
	}
	httpProvider, err := NewProvider(PayoutConfig{Provider: PayoutProviderWise, APIToken: "sandbox_token", BaseURL: wiseSandboxBaseURL})
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := httpProvider.(*HTTPProvider); !ok {
		t.Fatalf("got %T, want *HTTPProvider", httpProvider)
	}
}
