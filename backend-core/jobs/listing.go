package jobs

import (
	"context"
	"errors"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// Public listing statuses for a direct search row. Empty means the job was
// published before review existed and stays visible. Hiring-job status lives
// on company_jobs; these values only hide a search row that still carries one.
const (
	ListingPendingReview = "pending_review"
	ListingActive        = "active"
	ListingRemoved       = "removed"
	ListingDraft         = "draft"
	ListingExpired       = "expired"
)

// TakedownCauseDeadLink marks a listing closed because its apply URL stayed dead.
const TakedownCauseDeadLink = "dead_link"

// Company verification statuses. Empty is treated as unclaimed.
const (
	VerificationUnclaimed = "unclaimed"
	VerificationPending   = "pending"
	VerificationApproved  = "approved"
	VerificationRejected  = "rejected"
	VerificationSuspended = "suspended"
)

// Claim methods (docs/03 company_claims).
const (
	ClaimDomainEmail = "domain_email"
	ClaimDNSTXT      = "dns_txt"
	ClaimManual      = "manual"
)

// Hiring-job statuses on company_jobs. removed is staff-only.
const (
	JobOpen          = "open"
	JobPaused        = "paused"
	JobDraft         = "draft"
	JobClosed        = "closed"
	JobPendingReview = "pending_review"
	JobRemoved       = "removed"
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

// EffectiveVerification maps a missing status to unclaimed.
func EffectiveVerification(status string) string {
	if status == "" {
		return VerificationUnclaimed
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

// CompanyApproved reports whether the company may publish a direct job live.
// A missing company is not approved.
func (s *Store) CompanyApproved(ctx context.Context, id string) (bool, error) {
	if id == "" {
		return false, nil
	}
	var doc struct {
		VerificationStatus string `bson:"verificationStatus"`
	}
	err := s.companies().FindOne(ctx, bson.D{{Key: "id", Value: id}}, options.FindOne().SetProjection(bson.D{{Key: "verificationStatus", Value: 1}})).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return doc.VerificationStatus == VerificationApproved, nil
}
