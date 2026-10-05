package scout

import (
	"errors"
	"testing"
	"time"
)

func TestNamesMatch(t *testing.T) {
	t.Parallel()
	cases := []struct {
		legal, holder string
		want          bool
	}{
		{"Ada Lovelace", "ADA LOVELACE", true},
		{"Mary-Jane Watson", "Mary Jane Watson", true},
		{"José García", "José García", true},
		{"Ada Lovelace", "Ada L.", false},
		{"Ada Lovelace", "Grace Hopper", false},
		{"", "Ada Lovelace", false},
		{"Ada Lovelace", "", false},
	}
	for _, tc := range cases {
		if got := NamesMatch(tc.legal, tc.holder); got != tc.want {
			t.Errorf("NamesMatch(%q, %q) = %v, want %v", tc.legal, tc.holder, got, tc.want)
		}
	}
}

func TestFirstPayoutIdentityError(t *testing.T) {
	t.Parallel()
	ready := Profile{
		Verification: VerificationVerified,
		LegalName:    "Ada Lovelace",
		Country:      "GB",
		DateOfBirth:  "1990-12-10",
		PayoutMethod: &PayoutMethod{HolderName: "Ada Lovelace"},
	}
	if err := FirstPayoutIdentityError(ready, false); err != nil {
		t.Fatalf("verified complete first payout: %v", err)
	}
	if err := FirstPayoutIdentityError(Profile{Verification: VerificationNone}, false); !errors.Is(err, ErrIdentityUnverified) {
		t.Fatalf("unverified: %v", err)
	}
	if err := FirstPayoutIdentityError(Profile{Verification: VerificationPending}, false); !errors.Is(err, ErrIdentityUnverified) {
		t.Fatalf("pending: %v", err)
	}
	if err := FirstPayoutIdentityError(Profile{Verification: VerificationRejected}, false); !errors.Is(err, ErrIdentityRejected) {
		t.Fatalf("rejected: %v", err)
	}
	incomplete := ready
	incomplete.DateOfBirth = ""
	if err := FirstPayoutIdentityError(incomplete, false); !errors.Is(err, ErrIdentityIncomplete) {
		t.Fatalf("missing dob: %v", err)
	}
	mismatch := ready
	mismatch.PayoutMethod = &PayoutMethod{HolderName: "Grace Hopper"}
	if err := FirstPayoutIdentityError(mismatch, false); !errors.Is(err, ErrIdentityNameMismatch) {
		t.Fatalf("mismatch: %v", err)
	}
	legacy := Profile{Verification: VerificationVerified}
	if err := FirstPayoutIdentityError(legacy, true); err != nil {
		t.Fatalf("grandfathered paid scout: %v", err)
	}
	if err := FirstPayoutIdentityError(Profile{Verification: VerificationRejected}, true); !errors.Is(err, ErrIdentityRejected) {
		t.Fatalf("rejected still blocks later payouts: %v", err)
	}
}

func TestIdentityProblemCodes(t *testing.T) {
	t.Parallel()
	err := wrapPayoutIdentity(ErrIdentityNameMismatch)
	code, detail, ok := IdentityProblem(err)
	if !ok || code != CodeIdentityNameMismatch || detail != ErrIdentityNameMismatch.Error() {
		t.Fatalf("code=%q detail=%q ok=%v", code, detail, ok)
	}
	if _, _, ok := IdentityProblem(ErrPayoutBlocked); ok {
		t.Fatal("generic payout block is not an identity problem")
	}
}

func TestParseDateOfBirth(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)
	got, err := parseDateOfBirth("1991-04-15", now)
	if err != nil || got != "1991-04-15" {
		t.Fatalf("got %q err %v", got, err)
	}
	if _, err := parseDateOfBirth("15-04-1991", now); err == nil {
		t.Fatal("expected invalid format")
	}
	if _, err := parseDateOfBirth("2010-10-05", now); err == nil {
		t.Fatal("expected under 18")
	}
	if _, err := parseDateOfBirth("1890-01-01", now); err == nil {
		t.Fatal("expected too old")
	}
}

func TestParseDocumentRefRejectsIDNumbers(t *testing.T) {
	t.Parallel()
	if _, err := parseDocumentRef("vendor_tok-1"); err != nil {
		t.Fatal(err)
	}
	if _, err := parseDocumentRef("123-45-6789"); err == nil {
		t.Fatal("ssn-shaped ref")
	}
	if _, err := parseDocumentRef("123456789"); err == nil {
		t.Fatal("digit-only ref")
	}
}
