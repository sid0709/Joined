package jobs

import (
	"context"
	"errors"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// Public listing statuses for a direct job (docs/03). Empty means the job was
// published before review existed and stays visible.
const (
	ListingPendingReview = "pending_review"
	ListingActive        = "active"
	ListingRemoved       = "removed"
	ListingDraft         = "draft"
)

// Company trust statuses (docs/03). Empty is treated as unclaimed.
const (
	TrustUnclaimed = "unclaimed"
	TrustClaimed   = "claimed"
	TrustVerified  = "verified"
	TrustSuspended = "suspended"
)

// Claim methods (docs/03 company_claims).
const (
	ClaimDomainEmail = "domain_email"
	ClaimDNSTXT      = "dns_txt"
	ClaimManual      = "manual"
)

// Claim record statuses.
const (
	ClaimPending  = "pending"
	ClaimApproved = "approved"
	ClaimRejected = "rejected"
)

// Why a direct listing was taken out of search. Employer edits must not put it back.
const (
	TakedownStaff   = "staff"
	TakedownSuspend = "suspend"
)

// ListingPublic reports whether candidates can see a search listing.
// Missing and active listings stay public so older rows are unchanged.
func ListingPublic(status string) bool {
	switch status {
	case "", ListingActive:
		return true
	default:
		return false
	}
}

// ListingStatusForTrust is the listing status a company gets when it publishes.
// Only a verified company goes live; everyone else waits in pending_review.
func ListingStatusForTrust(trust string) string {
	if trust == TrustVerified {
		return ListingActive
	}
	return ListingPendingReview
}

// EffectiveTrust maps a missing status to unclaimed.
func EffectiveTrust(status string) string {
	if status == "" {
		return TrustUnclaimed
	}
	return status
}

// publicListingFilter keeps candidate search on legacy and active listings.
func publicListingFilter() bson.D {
	return bson.D{{Key: "listingStatus", Value: bson.D{{Key: "$in", Value: bson.A{nil, "", ListingActive}}}}}
}

func publicCompanyJobs(companyID string) bson.D {
	filter := publicListingFilter()
	return append(bson.D{{Key: "job.companyId", Value: companyID}}, filter...)
}

func (s *Store) companyTrustStatus(ctx context.Context, id string) (string, error) {
	if id == "" {
		return "", nil
	}
	var doc struct {
		TrustStatus string `bson:"trustStatus"`
	}
	err := s.companies().FindOne(ctx, bson.D{{Key: "id", Value: id}}, options.FindOne().SetProjection(bson.D{{Key: "trustStatus", Value: 1}})).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return doc.TrustStatus, nil
}

// heldDown reports a staff or suspension takedown that publishing must not undo.
func heldDown(doc storedSearchJob) bool {
	return doc.ListingStatus == ListingRemoved && (doc.TakedownCause == TakedownStaff || doc.TakedownCause == TakedownSuspend)
}
