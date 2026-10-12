package scout

import (
	"context"
	"errors"
	"testing"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func TestPayoutDoesNotSendBeforeApproval(t *testing.T) {
	store, fake := payoutReadyStore(t)
	payout := requestReadyPayout(t, store)
	if payout.Status != PayoutRequested {
		t.Fatalf("status = %q", payout.Status)
	}
	_, err := store.SendApprovedPayout(contextBG(), payout.ID)
	if !errors.Is(err, ErrPayoutNotApproved) {
		t.Fatalf("err = %v, want ErrPayoutNotApproved", err)
	}
	if fake.SendCount() != 0 {
		t.Fatalf("sends = %d, want 0", fake.SendCount())
	}
	balance, err := store.Balance(contextBG(), "scout-1")
	if err != nil {
		t.Fatal(err)
	}
	if balance.Processing.AmountCents != MinPayoutCents {
		t.Fatalf("processing = %d", balance.Processing.AmountCents)
	}
}

func TestPayoutApprovalSendsOnce(t *testing.T) {
	store, fake := payoutReadyStore(t)
	payout := requestReadyPayout(t, store)
	first, err := store.DecidePayout(contextBG(), payout.ID, "staff-1", PayoutDecision{Decision: PayoutDecisionPaid})
	if err != nil {
		t.Fatal(err)
	}
	if first.Status != PayoutSent {
		t.Fatalf("status = %q, want sent", first.Status)
	}
	if first.ProviderRef == "" || first.ApprovedAt == nil || first.SentAt == nil {
		t.Fatalf("payout = %+v", first)
	}
	if fake.SendCount() != 1 {
		t.Fatalf("sends = %d, want 1", fake.SendCount())
	}
	second, err := store.DecidePayout(contextBG(), payout.ID, "staff-1", PayoutDecision{Decision: PayoutDecisionPaid})
	if err != nil {
		t.Fatal(err)
	}
	if second.ProviderRef != first.ProviderRef {
		t.Fatalf("provider ref changed: %q vs %q", second.ProviderRef, first.ProviderRef)
	}
	if fake.SendCount() != 1 {
		t.Fatalf("retry sends = %d, want 1", fake.SendCount())
	}
}

func TestFakeSendPayoutIsIdempotentByPayoutID(t *testing.T) {
	fake := NewFakeProvider()
	first, err := fake.SendPayout(contextBG(), Transfer{PayoutID: "same", RecipientID: "rcp_1", AmountCents: 100, Currency: Currency})
	if err != nil {
		t.Fatal(err)
	}
	second, err := fake.SendPayout(contextBG(), Transfer{PayoutID: "same", RecipientID: "rcp_1", AmountCents: 100, Currency: Currency})
	if err != nil {
		t.Fatal(err)
	}
	if first.ProviderRef != second.ProviderRef || fake.SendCount() != 1 {
		t.Fatalf("first=%+v second=%+v sends=%d", first, second, fake.SendCount())
	}
}

func TestPayoutSendFailureRestoresBalance(t *testing.T) {
	store, fake := payoutReadyStore(t)
	payout := requestReadyPayout(t, store)
	fake.FailNextSend()
	failed, err := store.DecidePayout(contextBG(), payout.ID, "staff-1", PayoutDecision{Decision: PayoutDecisionPaid})
	if err != nil {
		t.Fatal(err)
	}
	if failed.Status != PayoutFailed {
		t.Fatalf("status = %q, want failed", failed.Status)
	}
	if fake.SendCount() != 0 {
		t.Fatalf("sends = %d", fake.SendCount())
	}
	balance, err := store.Balance(contextBG(), "scout-1")
	if err != nil {
		t.Fatal(err)
	}
	if balance.Released.AmountCents != MinPayoutCents || balance.Processing.AmountCents != 0 || balance.Paid.AmountCents != 0 {
		t.Fatalf("balance = %+v", balance)
	}
}

func TestPayoutRejectRestoresBalanceWithoutSend(t *testing.T) {
	store, fake := payoutReadyStore(t)
	payout := requestReadyPayout(t, store)
	rejected, err := store.DecidePayout(contextBG(), payout.ID, "staff-1", PayoutDecision{Decision: PayoutDecisionReject, Note: "mismatch"})
	if err != nil {
		t.Fatal(err)
	}
	if rejected.Status != PayoutRejected {
		t.Fatalf("status = %q", rejected.Status)
	}
	if fake.SendCount() != 0 {
		t.Fatalf("sends = %d", fake.SendCount())
	}
	balance, err := store.Balance(contextBG(), "scout-1")
	if err != nil {
		t.Fatal(err)
	}
	if balance.Released.AmountCents != MinPayoutCents {
		t.Fatalf("released = %d", balance.Released.AmountCents)
	}
}

func TestStaffApproveUnverifiedFirstPayoutDoesNotSend(t *testing.T) {
	store, fake := payoutReadyStore(t)
	payout := requestReadyPayout(t, store)
	mem := store.docs.(*memDocs)
	if _, err := mem.applyProfile("scout-1", func(p *Profile) {
		p.Verification = VerificationNone
	}); err != nil {
		t.Fatal(err)
	}
	_, err := store.DecidePayout(contextBG(), payout.ID, "staff-1", PayoutDecision{Decision: PayoutDecisionApprove})
	if !errors.Is(err, ErrIdentityUnverified) || !errors.Is(err, ErrPayoutBlocked) {
		t.Fatalf("err = %v, want identity_unverified", err)
	}
	if fake.SendCount() != 0 {
		t.Fatalf("sends = %d, want 0", fake.SendCount())
	}
}

func TestSavePayoutMethodStoresRecipientNotBankNumber(t *testing.T) {
	store, _ := payoutReadyStore(t)
	_, err := store.SavePayoutMethod(contextBG(), "scout-1", PayoutMethodInput{
		Type:       payoutProvider,
		Label:      "Wise",
		Country:    "DE",
		Currency:   "EUR",
		Email:      "ada@example.com",
		AccountRef: "DE89370400440532013000",
	})
	if err == nil {
		t.Fatal("expected IBAN rejection")
	}
	profile, err := store.SavePayoutMethod(contextBG(), "scout-1", PayoutMethodInput{
		Type:     payoutProvider,
		Label:    "Wise",
		Country:  "DE",
		Currency: "EUR",
		Email:    "ada@example.com",
	})
	if err != nil {
		t.Fatal(err)
	}
	if profile.PayoutMethod == nil || profile.PayoutMethod.RecipientID == "" {
		t.Fatalf("method = %+v", profile.PayoutMethod)
	}
	if profile.PayoutMethod.Last4 != "ecom" {
		t.Fatalf("last4 = %q", profile.PayoutMethod.Last4)
	}
}

func TestWebhookPaidMarksEarningsPaid(t *testing.T) {
	store, fake := payoutReadyStore(t)
	payout := requestReadyPayout(t, store)
	sent, err := store.DecidePayout(contextBG(), payout.ID, "staff-1", PayoutDecision{Decision: PayoutDecisionPaid})
	if err != nil {
		t.Fatal(err)
	}
	_, err = store.ApplyProviderEvent(contextBG(), ProviderEvent{
		ID:          "evt_paid",
		PayoutID:    sent.ID,
		ProviderRef: sent.ProviderRef,
		Status:      ProviderStatusPaid,
	})
	if err != nil {
		t.Fatal(err)
	}
	paid, err := store.payout(contextBG(), sent.ID)
	if err != nil {
		t.Fatal(err)
	}
	if paid.Status != PayoutPaid {
		t.Fatalf("status = %q", paid.Status)
	}
	again, err := store.ApplyProviderEvent(contextBG(), ProviderEvent{
		ID:          "evt_paid",
		PayoutID:    sent.ID,
		ProviderRef: sent.ProviderRef,
		Status:      ProviderStatusPaid,
	})
	if err != nil {
		t.Fatal(err)
	}
	if again.Status != PayoutPaid {
		t.Fatalf("replay status = %q", again.Status)
	}
	if fake.SendCount() != 1 {
		t.Fatalf("sends = %d", fake.SendCount())
	}
	balance, err := store.Balance(contextBG(), "scout-1")
	if err != nil {
		t.Fatal(err)
	}
	if balance.Paid.AmountCents != MinPayoutCents || balance.Processing.AmountCents != 0 {
		t.Fatalf("balance = %+v", balance)
	}
}

func payoutReadyStore(t *testing.T) (*Store, *FakeProvider) {
	t.Helper()
	store, _ := memoryScout(t, "scout-1")
	now := store.now().UTC()
	MemoryPatchProfile(store, "scout-1", func(profile *Profile) {
		profile.Verification = VerificationVerified
		profile.LegalName = "Ada Scout"
		profile.Country = "US"
		profile.DateOfBirth = "1991-04-15"
		profile.TaxInfo = &TaxInfo{LegalName: "Ada Scout", Country: "US", TaxIDLast4: "1234", FormType: TaxFormW9, CertifiedAt: now, CompletedAt: now, ScreeningStatus: ScreeningClear}
	})
	_, err := store.SavePayoutMethod(contextBG(), "scout-1", PayoutMethodInput{
		Type:       payoutPayPal,
		Label:      "PayPal",
		Last4:      "mail",
		HolderName: "Ada Scout",
		Country:    "US",
		Currency:   Currency,
		Email:      "ada@example.com",
	})
	if err != nil {
		t.Fatal(err)
	}
	MemoryInsertEarning(store, Earning{
		ObjectID:    bson.NewObjectID(),
		ScoutUserID: "scout-1",
		Type:        RewardApply,
		Amount:      cents(MinPayoutCents),
		Status:      EarningReleased,
		Description: "apply",
		HoldUntil:   now,
		CreatedAt:   now,
		ReleasedAt:  &now,
	})
	fake, ok := store.payoutProvider.(*FakeProvider)
	if !ok {
		t.Fatalf("provider = %T", store.payoutProvider)
	}
	return store, fake
}

func requestReadyPayout(t *testing.T, store *Store) Payout {
	t.Helper()
	payout, err := store.RequestPayout(contextBG(), "scout-1")
	if err != nil {
		t.Fatal(err)
	}
	return payout
}

func contextBG() context.Context { return context.Background() }

func TestNormalizeProviderStatus(t *testing.T) {
	if got := NormalizeProviderStatus("COMPLETED"); got != ProviderStatusPaid {
		t.Fatalf("got %q", got)
	}
	if got := NormalizeProviderStatus("processing"); got != ProviderStatusSent {
		t.Fatalf("got %q", got)
	}
	if got := MapProviderStatus("failed"); got != PayoutFailed {
		t.Fatalf("got %q", got)
	}
}

func TestDeriveLast4(t *testing.T) {
	if got := deriveLast4("ada@example.com", ""); got != "ecom" {
		t.Fatalf("got %q", got)
	}
}
