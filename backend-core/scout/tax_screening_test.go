package scout

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const fullTIN = "123-45-6789"

func TestSaveTaxForm(t *testing.T) {
	ctx := context.Background()
	store, _ := memoryScout(t, "scout-1")
	if _, err := store.EnsureProfile(ctx, "scout-1"); err != nil {
		t.Fatal(err)
	}

	_, err := store.SaveTaxInfo(ctx, "scout-1", TaxInput{LegalName: "Ada Lovelace", Country: "US", TaxIDLast4: "6789"})
	var fields *ValidationError
	if !errors.As(err, &fields) || !hasField(fields, "form_type") {
		t.Fatalf("missing form: %v", err)
	}

	_, err = store.SaveTaxInfo(ctx, "scout-1", TaxInput{LegalName: "Ada Lovelace", Country: "GB", TaxIDLast4: "6789", FormType: TaxFormW9})
	if !errors.As(err, &fields) || !hasField(fields, "form_type") {
		t.Fatalf("w9 outside US: %v", err)
	}

	_, err = store.SaveTaxInfo(ctx, "scout-1", TaxInput{LegalName: "Ada Lovelace", Country: "US", TaxIDLast4: "6789", FormType: TaxFormW8BEN})
	if !errors.As(err, &fields) || !hasField(fields, "form_type") {
		t.Fatalf("w8ben in US: %v", err)
	}

	profile, err := store.SaveTaxInfo(ctx, "scout-1", TaxInput{LegalName: "Ada Lovelace", Country: "US", TaxIDLast4: "6789", FormType: TaxFormW9})
	if err != nil {
		t.Fatal(err)
	}
	if profile.TaxInfo == nil || profile.TaxInfo.FormType != TaxFormW9 || profile.TaxInfo.CertifiedAt.IsZero() {
		t.Fatalf("tax = %+v", profile.TaxInfo)
	}
	if profile.TaxInfo.TaxIDLast4 != "6789" || strings.Contains(profile.TaxInfo.TaxIDLast4, fullTIN) {
		t.Fatalf("stored id = %q", profile.TaxInfo.TaxIDLast4)
	}

	profile, err = store.SaveTaxInfo(ctx, "scout-1", TaxInput{LegalName: "Ada Lovelace", Country: "DE", TaxIDLast4: "6789", FormType: TaxFormW8BENE})
	if err != nil {
		t.Fatal(err)
	}
	if profile.TaxInfo.FormType != TaxFormW8BENE || profile.TaxInfo.Country != "DE" {
		t.Fatalf("tax = %+v", profile.TaxInfo)
	}
}

func TestW8BENClearAllowsPayout(t *testing.T) {
	ctx := context.Background()
	store, _ := memoryScout(t, "scout-1")
	seedPayoutSetup(t, store, "scout-1", "Ada Lovelace")
	if _, err := store.RequestVerification(ctx, "scout-1", validIdentity()); err != nil {
		t.Fatal(err)
	}
	if _, err := store.UpdateScout(ctx, "scout-1", "staff-1", ScoutPatch{Verification: ptr(VerificationVerified)}); err != nil {
		t.Fatal(err)
	}
	payout, err := store.RequestPayout(ctx, "scout-1")
	if err != nil {
		t.Fatalf("w8ben clear: %v", err)
	}
	if payout.Status != PayoutRequested {
		t.Fatalf("status = %s", payout.Status)
	}
	profile, err := store.Profile(ctx, "scout-1")
	if err != nil {
		t.Fatal(err)
	}
	if profile.TaxInfo.FormType != TaxFormW8BEN || profile.TaxInfo.ScreeningStatus != ScreeningClear {
		t.Fatalf("tax = %+v", profile.TaxInfo)
	}
}

func TestMissingTaxFormBlocksPayout(t *testing.T) {
	ctx := context.Background()
	store, _ := memoryScout(t, "scout-1")
	if _, err := store.EnsureProfile(ctx, "scout-1"); err != nil {
		t.Fatal(err)
	}
	if _, err := store.SavePayoutMethod(ctx, "scout-1", PayoutMethodInput{Type: payoutBank, Label: "Barclays", Last4: "9999", HolderName: "Ada Lovelace"}); err != nil {
		t.Fatal(err)
	}
	MemoryAddReleasedEarning(store, "scout-1", 2600)
	if _, err := store.RequestVerification(ctx, "scout-1", validIdentity()); err != nil {
		t.Fatal(err)
	}
	if _, err := store.UpdateScout(ctx, "scout-1", "staff-1", ScoutPatch{Verification: ptr(VerificationVerified)}); err != nil {
		t.Fatal(err)
	}
	_, err := store.RequestPayout(ctx, "scout-1")
	if !errors.Is(err, ErrTaxFormRequired) || !errors.Is(err, ErrPayoutBlocked) {
		t.Fatalf("missing form: %v", err)
	}
	if strings.Contains(err.Error(), fullTIN) {
		t.Fatalf("error leaked a tax id: %v", err)
	}
}

func TestScreeningHitAndProviderErrorBlock(t *testing.T) {
	ctx := context.Background()
	store, _ := memoryScout(t, "scout-1")
	seedPayoutSetup(t, store, "scout-1", "Ada Lovelace")
	if _, err := store.RequestVerification(ctx, "scout-1", validIdentity()); err != nil {
		t.Fatal(err)
	}
	if _, err := store.UpdateScout(ctx, "scout-1", "staff-1", ScoutPatch{Verification: ptr(VerificationVerified)}); err != nil {
		t.Fatal(err)
	}

	store.SetScreener(&FakeScreener{Status: ScreeningHit})
	_, err := store.RequestPayout(ctx, "scout-1")
	if !errors.Is(err, ErrScreeningBlocked) {
		t.Fatalf("hit: %v", err)
	}
	if strings.Contains(err.Error(), fullTIN) {
		t.Fatalf("hit error leaked a tax id: %v", err)
	}

	store.SetScreener(&FakeScreener{Err: errors.New(fullTIN)})
	_, err = store.RequestPayout(ctx, "scout-1")
	if !errors.Is(err, ErrScreeningBlocked) || strings.Contains(err.Error(), fullTIN) {
		t.Fatalf("provider error: %v", err)
	}
	profile, err := store.Profile(ctx, "scout-1")
	if err != nil {
		t.Fatal(err)
	}
	if profile.TaxInfo.ScreeningStatus != ScreeningPending {
		t.Fatalf("status = %s", profile.TaxInfo.ScreeningStatus)
	}
}

func TestStoredClearSkipsProviderUntilRevoke(t *testing.T) {
	ctx := context.Background()
	store, _ := memoryScout(t, "scout-1")
	seedPayoutSetup(t, store, "scout-1", "Ada Lovelace")
	if _, err := store.RequestVerification(ctx, "scout-1", validIdentity()); err != nil {
		t.Fatal(err)
	}
	if _, err := store.UpdateScout(ctx, "scout-1", "staff-1", ScoutPatch{Verification: ptr(VerificationVerified)}); err != nil {
		t.Fatal(err)
	}
	MemoryPatchProfile(store, "scout-1", func(profile *Profile) {
		profile.TaxInfo.ScreeningStatus = ScreeningClear
	})
	store.SetScreener(&FakeScreener{Err: errors.New(fullTIN)})
	if _, err := store.RequestPayout(ctx, "scout-1"); err != nil {
		t.Fatalf("stored clear: %v", err)
	}

	if _, err := store.RevokeScreening(ctx, "scout-1"); err != nil {
		t.Fatal(err)
	}
	store.SetScreener(&FakeScreener{Status: ScreeningHit})
	_, err := store.RequestPayout(ctx, "scout-1")
	if !errors.Is(err, ErrScreeningBlocked) {
		t.Fatalf("revoked: %v", err)
	}
}

func TestStaffSendBlockedWhenScreeningHits(t *testing.T) {
	ctx := context.Background()
	store, _ := memoryScout(t, "scout-1")
	seedPayoutSetup(t, store, "scout-1", "Ada Lovelace")
	if _, err := store.RequestVerification(ctx, "scout-1", validIdentity()); err != nil {
		t.Fatal(err)
	}
	if _, err := store.UpdateScout(ctx, "scout-1", "staff-1", ScoutPatch{Verification: ptr(VerificationVerified)}); err != nil {
		t.Fatal(err)
	}
	payout, err := store.RequestPayout(ctx, "scout-1")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.RevokeScreening(ctx, "scout-1"); err != nil {
		t.Fatal(err)
	}
	store.SetScreener(&FakeScreener{Status: ScreeningHit})
	_, err = store.DecidePayout(ctx, payout.ID, "staff-1", PayoutDecision{Decision: PayoutDecisionPaid})
	if !errors.Is(err, ErrScreeningBlocked) {
		t.Fatalf("staff send: %v", err)
	}
}

func TestScreeningConfigDefaultsToFake(t *testing.T) {
	t.Setenv(envPayoutScreeningProvider, "")
	t.Setenv(envPayoutScreeningURL, "")
	cfg, err := LoadScreeningConfig()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Provider != ScreeningProviderFake || cfg.URL != "" {
		t.Fatalf("cfg = %+v", cfg)
	}
	screen, err := NewScreener(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := screen.(*FakeScreener); !ok {
		t.Fatalf("screener = %T", screen)
	}

	t.Setenv(envPayoutScreeningProvider, ScreeningProviderHTTP)
	if _, err := LoadScreeningConfig(); err == nil {
		t.Fatal("http provider without a URL should fail")
	}
	t.Setenv(envPayoutScreeningProvider, "live-vendor")
	if _, err := LoadScreeningConfig(); err == nil {
		t.Fatal("unknown provider should fail")
	}
}

func TestHTTPScreenerOmitsTaxID(t *testing.T) {
	var body string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		body = string(raw)
		if r.Header.Get("Authorization") != "Bearer secret" {
			t.Errorf("authorization = %q", r.Header.Get("Authorization"))
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"clear"}`))
	}))
	t.Cleanup(server.Close)

	screen, err := NewScreener(ScreeningConfig{Provider: ScreeningProviderHTTP, URL: server.URL, Token: "secret"})
	if err != nil {
		t.Fatal(err)
	}
	result, err := screen.Screen(context.Background(), ScreeningSubject{UserID: "scout-1", Country: "US", FormType: TaxFormW9})
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != ScreeningClear {
		t.Fatalf("status = %s", result.Status)
	}
	if strings.Contains(body, fullTIN) || strings.Contains(body, "tax_id") {
		t.Fatalf("request included a tax id: %s", body)
	}
	if !strings.Contains(body, `"form_type":"w9"`) || !strings.Contains(body, `"user_id":"scout-1"`) {
		t.Fatalf("body = %s", body)
	}
}
