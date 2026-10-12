package scout

import (
	"context"
	"errors"
	"testing"
)

func TestRequestPayoutBlockedUntilIdentityVerified(t *testing.T) {
	ctx := context.Background()
	store, _ := memoryScout(t, "scout-1")
	seedPayoutSetup(t, store, "scout-1", "Ada Lovelace")

	_, err := store.RequestPayout(ctx, "scout-1")
	if !errors.Is(err, ErrIdentityUnverified) || !errors.Is(err, ErrPayoutBlocked) {
		t.Fatalf("unverified first payout: %v", err)
	}

	if _, err := store.RequestVerification(ctx, "scout-1", validIdentity()); err != nil {
		t.Fatalf("RequestVerification: %v", err)
	}
	if _, err := store.UpdateScout(ctx, "scout-1", "staff-1", ScoutPatch{Verification: ptr(VerificationVerified)}); err != nil {
		t.Fatalf("UpdateScout verify: %v", err)
	}

	payout, err := store.RequestPayout(ctx, "scout-1")
	if err != nil {
		t.Fatalf("verified first payout: %v", err)
	}
	if payout.Status != PayoutRequested || payout.Amount.AmountCents != 2600 {
		t.Fatalf("payout = %+v", payout)
	}
}

func TestRequestPayoutNameMismatchRejected(t *testing.T) {
	ctx := context.Background()
	store, _ := memoryScout(t, "scout-1")
	seedPayoutSetup(t, store, "scout-1", "Grace Hopper")

	_, err := store.RequestVerification(ctx, "scout-1", validIdentity())
	if !errors.Is(err, ErrIdentityNameMismatch) {
		t.Fatalf("submit mismatch: %v", err)
	}

	if _, err := store.SavePayoutMethod(ctx, "scout-1", PayoutMethodInput{Type: payoutBank, Label: "Barclays", Last4: "9999"}); err != nil {
		t.Fatal(err)
	}
	if _, err := store.RequestVerification(ctx, "scout-1", validIdentity()); err != nil {
		t.Fatalf("submit without holder: %v", err)
	}
	if _, err := store.SavePayoutMethod(ctx, "scout-1", PayoutMethodInput{Type: payoutBank, Label: "Barclays", Last4: "9999", HolderName: "Grace Hopper"}); err != nil {
		t.Fatal(err)
	}
	_, err = store.UpdateScout(ctx, "scout-1", "staff-1", ScoutPatch{Verification: ptr(VerificationVerified)})
	var fields *ValidationError
	if !errors.As(err, &fields) || !hasField(fields, "verification") {
		t.Fatalf("staff verify mismatch: %v", err)
	}

	mem := store.docs.(*memDocs)
	if _, err := mem.applyProfile("scout-1", func(p *Profile) {
		p.Verification = VerificationVerified
		p.VerifiedBy = "staff-1"
	}); err != nil {
		t.Fatal(err)
	}
	_, err = store.RequestPayout(ctx, "scout-1")
	if !errors.Is(err, ErrIdentityNameMismatch) {
		t.Fatalf("payout mismatch: %v", err)
	}
}

func TestRequestPayoutRejectedStatusBlocks(t *testing.T) {
	ctx := context.Background()
	store, _ := memoryScout(t, "scout-1")
	seedPayoutSetup(t, store, "scout-1", "Ada Lovelace")
	if _, err := store.RequestVerification(ctx, "scout-1", validIdentity()); err != nil {
		t.Fatal(err)
	}
	if _, err := store.UpdateScout(ctx, "scout-1", "staff-1", ScoutPatch{Verification: ptr(VerificationRejected), Note: "docs unclear"}); err != nil {
		t.Fatal(err)
	}
	_, err := store.RequestPayout(ctx, "scout-1")
	if !errors.Is(err, ErrIdentityRejected) {
		t.Fatalf("rejected payout: %v", err)
	}
	_, err = store.DecidePayout(ctx, "missing", "staff-1", PayoutDecision{Decision: PayoutDecisionPaid})
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("missing payout: %v", err)
	}
}

func TestDecidePayoutFirstPaidRequiresIdentity(t *testing.T) {
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
	mem := store.docs.(*memDocs)
	if _, err := mem.applyProfile("scout-1", func(p *Profile) {
		p.Verification = VerificationRejected
	}); err != nil {
		t.Fatal(err)
	}
	_, err = store.DecidePayout(ctx, payout.ID, "staff-1", PayoutDecision{Decision: PayoutDecisionPaid})
	if !errors.Is(err, ErrIdentityRejected) {
		t.Fatalf("staff paid first payout after reject: %v", err)
	}
}

func TestPaidPayoutGrandfathersVerifiedScout(t *testing.T) {
	ctx := context.Background()
	store, _ := memoryScout(t, "scout-1")
	if _, err := store.EnsureProfile(ctx, "scout-1"); err != nil {
		t.Fatal(err)
	}
	if _, err := store.SaveTaxInfo(ctx, "scout-1", TaxInput{LegalName: "Ada Lovelace", Country: "GB", TaxIDLast4: "1234", FormType: TaxFormW8BEN}); err != nil {
		t.Fatal(err)
	}
	if _, err := store.SavePayoutMethod(ctx, "scout-1", PayoutMethodInput{Type: payoutBank, Label: "Barclays", Last4: "9999"}); err != nil {
		t.Fatal(err)
	}
	mem := store.docs.(*memDocs)
	if _, err := mem.applyProfile("scout-1", func(p *Profile) {
		p.Verification = VerificationVerified
	}); err != nil {
		t.Fatal(err)
	}
	MemoryAddPaidPayout(store, "scout-1")
	MemoryAddReleasedEarning(store, "scout-1", 2600)

	payout, err := store.RequestPayout(ctx, "scout-1")
	if err != nil {
		t.Fatalf("grandfathered scout: %v", err)
	}
	if _, err := store.DecidePayout(ctx, payout.ID, "staff-1", PayoutDecision{Decision: PayoutDecisionPaid}); err != nil {
		t.Fatalf("staff paid later payout: %v", err)
	}
}

func TestIdentityReadAndSubmit(t *testing.T) {
	ctx := context.Background()
	store, _ := memoryScout(t, "scout-1")
	if _, err := store.EnsureProfile(ctx, "scout-1"); err != nil {
		t.Fatal(err)
	}
	got, err := store.Identity(ctx, "scout-1")
	if err != nil {
		t.Fatal(err)
	}
	if got.Status != VerificationNone || !got.FirstPayoutGated || got.NameMatches {
		t.Fatalf("identity = %+v", got)
	}
	if _, err := store.RequestVerification(ctx, "scout-1", VerificationRequest{LegalName: "Ada", Country: "GB"}); err == nil {
		t.Fatal("expected date of birth required")
	}
	if _, err := store.RequestVerification(ctx, "scout-1", validIdentity()); err != nil {
		t.Fatal(err)
	}
	got, err = store.Identity(ctx, "scout-1")
	if err != nil {
		t.Fatal(err)
	}
	if got.Status != VerificationPending || got.DateOfBirth != "1991-04-15" || got.LegalName != "Ada Lovelace" {
		t.Fatalf("pending identity = %+v", got)
	}
}

func seedPayoutSetup(t *testing.T, store *Store, userID, holder string) {
	t.Helper()
	ctx := context.Background()
	if _, err := store.EnsureProfile(ctx, userID); err != nil {
		t.Fatal(err)
	}
	if _, err := store.SaveTaxInfo(ctx, userID, TaxInput{LegalName: "Ada Lovelace", Country: "GB", TaxIDLast4: "1234", FormType: TaxFormW8BEN}); err != nil {
		t.Fatal(err)
	}
	if _, err := store.SavePayoutMethod(ctx, userID, PayoutMethodInput{Type: payoutBank, Label: "Barclays", Last4: "9999", HolderName: holder}); err != nil {
		t.Fatal(err)
	}
	MemoryAddReleasedEarning(store, userID, 2600)
}

func validIdentity() VerificationRequest {
	return VerificationRequest{
		LegalName:   "Ada Lovelace",
		Country:     "GB",
		DateOfBirth: "1991-04-15",
		DocumentRef: "vendor_tok-ada-1",
	}
}

func ptr[T any](v T) *T { return &v }
