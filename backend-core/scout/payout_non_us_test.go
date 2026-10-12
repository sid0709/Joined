package scout

import "testing"

// Non-US payout harness. It uses the in-memory store, a W-8BEN certification,
// and FakeProvider. It does not open an HTTP client or call Wise, Payoneer, or PayPal.
//
//	go test ./backend-core/scout/ -run TestNonUSPayout
const (
	nonUSPayoutCountry  = "GB"
	nonUSPayoutCurrency = "GBP"
	nonUSPayoutForm     = TaxFormW8BEN
	nonUSPayoutHolder   = "Alex Rivera"
	nonUSPayoutEmail    = "alex.rivera@example.com"
)

func TestNonUSPayout(t *testing.T) {
	ctx := contextBG()
	store, _ := memoryScout(t, "scout-gb")
	if _, ok := store.provider().(*FakeProvider); !ok {
		t.Fatalf("provider = %T, want FakeProvider", store.provider())
	}
	if _, err := store.EnsureProfile(ctx, "scout-gb"); err != nil {
		t.Fatal(err)
	}
	if _, err := store.SaveTaxInfo(ctx, "scout-gb", TaxInput{
		LegalName:  nonUSPayoutHolder,
		Country:    nonUSPayoutCountry,
		TaxIDLast4: "6789",
		FormType:   nonUSPayoutForm,
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := store.SavePayoutMethod(ctx, "scout-gb", PayoutMethodInput{
		Type:       payoutPayPal,
		Label:      "PayPal",
		HolderName: nonUSPayoutHolder,
		Country:    nonUSPayoutCountry,
		Currency:   nonUSPayoutCurrency,
		Email:      nonUSPayoutEmail,
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := store.RequestVerification(ctx, "scout-gb", VerificationRequest{
		LegalName:   nonUSPayoutHolder,
		Country:     nonUSPayoutCountry,
		DateOfBirth: "1991-04-15",
		DocumentRef: "vendor_tok-alex-1",
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := store.UpdateScout(ctx, "scout-gb", "staff-1", ScoutPatch{Verification: ptr(VerificationVerified)}); err != nil {
		t.Fatal(err)
	}
	MemoryAddReleasedEarning(store, "scout-gb", MinPayoutCents)

	payout, err := store.RequestPayout(ctx, "scout-gb")
	if err != nil {
		t.Fatal(err)
	}
	if payout.Method.Country != nonUSPayoutCountry || payout.Method.Currency != nonUSPayoutCurrency {
		t.Fatalf("method = %+v", payout.Method)
	}
	sent, err := store.DecidePayout(ctx, payout.ID, "staff-1", PayoutDecision{Decision: PayoutDecisionPaid})
	if err != nil {
		t.Fatal(err)
	}
	if sent.Status != PayoutSent || sent.ProviderRef == "" {
		t.Fatalf("sent = %+v", sent)
	}
	fake, ok := store.provider().(*FakeProvider)
	if !ok {
		t.Fatalf("provider = %T", store.provider())
	}
	if fake.SendCount() != 1 {
		t.Fatalf("sends = %d", fake.SendCount())
	}
	profile, err := store.Profile(ctx, "scout-gb")
	if err != nil {
		t.Fatal(err)
	}
	if profile.TaxInfo == nil || profile.TaxInfo.FormType != nonUSPayoutForm || profile.TaxInfo.Country != nonUSPayoutCountry {
		t.Fatalf("tax = %+v", profile.TaxInfo)
	}
	if profile.TaxInfo.ScreeningStatus != ScreeningClear {
		t.Fatalf("screening = %s", profile.TaxInfo.ScreeningStatus)
	}
}
