package jobs

import "testing"

func TestListingPublicKeepsLegacyRowsVisible(t *testing.T) {
	if !ListingPublic("") || !ListingPublic(ListingActive) {
		t.Fatal("active and legacy listings should stay public")
	}
	for _, status := range []string{ListingPendingReview, ListingRemoved, ListingDraft} {
		if ListingPublic(status) {
			t.Fatalf("%s should be hidden", status)
		}
	}
}

func TestListingStatusForTrust(t *testing.T) {
	if ListingStatusForTrust(TrustVerified) != ListingActive {
		t.Fatal("verified companies publish active listings")
	}
	for _, trust := range []string{"", TrustUnclaimed, TrustClaimed, TrustSuspended} {
		if ListingStatusForTrust(trust) != ListingPendingReview {
			t.Fatalf("%q should publish pending_review", trust)
		}
	}
}

func TestEffectiveTrust(t *testing.T) {
	if EffectiveTrust("") != TrustUnclaimed || EffectiveTrust(TrustClaimed) != TrustClaimed {
		t.Fatal("effective trust")
	}
}
