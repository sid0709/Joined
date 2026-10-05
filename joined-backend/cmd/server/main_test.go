package main

import (
	"strings"
	"testing"

	"github.com/sid0709/OpenSeat/backend-core/billing"
)

func TestOpenBillingSkipsWhenSecretUnset(t *testing.T) {
	t.Setenv("STRIPE_SECRET_KEY", "")
	t.Setenv("STRIPE_ALLOW_LIVE", "")
	svc, router, err := openBilling(billing.NewMemoryStore())
	if err != nil {
		t.Fatalf("openBilling: %v", err)
	}
	if svc != nil || router != nil {
		t.Fatal("expected billing to stay unmounted when STRIPE_SECRET_KEY is unset")
	}
}

func TestOpenBillingRefusesLiveKeyWithoutAllow(t *testing.T) {
	t.Setenv("STRIPE_SECRET_KEY", "sk_live_example")
	t.Setenv("STRIPE_ALLOW_LIVE", "")
	_, _, err := openBilling(billing.NewMemoryStore())
	if err == nil {
		t.Fatal("expected live-key guard to reject sk_live_ without STRIPE_ALLOW_LIVE")
	}
	if !strings.Contains(err.Error(), "STRIPE_ALLOW_LIVE") {
		t.Fatalf("error = %q, want live-key guard", err)
	}
}

func TestOpenBillingAcceptsTestKey(t *testing.T) {
	t.Setenv("STRIPE_SECRET_KEY", "sk_test_example")
	t.Setenv("STRIPE_WEBHOOK_SECRET", "whsec_example")
	t.Setenv("STRIPE_ALLOW_LIVE", "")
	svc, router, err := openBilling(billing.NewMemoryStore())
	if err != nil {
		t.Fatalf("openBilling: %v", err)
	}
	if svc == nil || router == nil {
		t.Fatal("expected billing service and webhook router for a test key")
	}
}
