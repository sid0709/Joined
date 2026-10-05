package jobs

import "testing"

func TestListingPublicKeepsLegacyRowsVisible(t *testing.T) {
	if !ListingPublic("") || !ListingPublic(ListingActive) {
		t.Fatal("active and legacy listings should stay public")
	}
	for _, status := range []string{ListingPendingReview, ListingRemoved, ListingDraft, ListingExpired} {
		if ListingPublic(status) {
			t.Fatalf("%s should be hidden", status)
		}
	}
}

func TestEffectiveVerification(t *testing.T) {
	if EffectiveVerification("") != VerificationUnclaimed {
		t.Fatal("missing status is unclaimed")
	}
	if EffectiveVerification(VerificationApproved) != VerificationApproved {
		t.Fatal("approved stays approved")
	}
}
