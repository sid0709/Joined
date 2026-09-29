package staff

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/opened-backend/internal/jobs"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type storedDirect struct {
	PostedAt              time.Time `bson:"postedAt"`
	Source                string    `bson:"source"`
	ListingStatus         string    `bson:"listingStatus"`
	PreviousListingStatus string    `bson:"previousListingStatus"`
	TakedownCause         string    `bson:"takedownCause"`
	ReviewNote            string    `bson:"reviewNote"`
	ReviewedBy            string    `bson:"reviewedBy"`
	ReviewedAt            time.Time `bson:"reviewedAt"`
	Job                   struct {
		ID        string `bson:"id"`
		Title     string `bson:"title"`
		Company   string `bson:"company"`
		CompanyID string `bson:"companyId"`
		Location  string `bson:"location"`
		Workplace string `bson:"workplace"`
		Summary   string `bson:"summary"`
	} `bson:"job"`
}

func (doc storedDirect) view() DirectJob {
	status := doc.ListingStatus
	if status == "" {
		status = jobs.ListingActive
	}
	return DirectJob{
		ID:                    doc.Job.ID,
		Source:                jobs.DirectSource,
		ListingStatus:         status,
		PreviousListingStatus: doc.PreviousListingStatus,
		TakedownCause:         doc.TakedownCause,
		Title:                 doc.Job.Title,
		Company:               doc.Job.Company,
		CompanyID:             doc.Job.CompanyID,
		Location:              doc.Job.Location,
		Workplace:             doc.Job.Workplace,
		Summary:               doc.Job.Summary,
		ReviewNote:            doc.ReviewNote,
		ReviewedBy:            doc.ReviewedBy,
		ReviewedAt:            doc.ReviewedAt,
		PostedAt:              doc.PostedAt,
	}
}

func (doc storedDirect) state() ListingState {
	return ListingState{Status: doc.ListingStatus, Previous: doc.PreviousListingStatus, Cause: doc.TakedownCause}
}

// JobQuery filters direct listings. Status defaults to pending_review. "all" lists every direct status.
type JobQuery struct {
	Source   string
	Status   string
	Q        string
	Page     int64
	PageSize int64
}

// ListDirectJobs returns direct jobs for staff review.
func (s *Store) ListDirectJobs(ctx context.Context, query JobQuery) (Page[DirectJob], error) {
	page, size := pageBounds(query.Page, query.PageSize)
	filter, err := directFilter(query)
	if err != nil {
		return Page[DirectJob]{}, err
	}
	total, err := s.searchJobs().CountDocuments(ctx, filter)
	if err != nil {
		return Page[DirectJob]{}, err
	}
	opts := options.Find().
		SetSkip((page - 1) * size).
		SetLimit(size).
		SetSort(bson.D{{Key: "postedAt", Value: 1}, {Key: "_id", Value: 1}})
	cursor, err := s.searchJobs().Find(ctx, filter, opts)
	if err != nil {
		return Page[DirectJob]{}, err
	}
	defer cursor.Close(ctx)
	var docs []storedDirect
	if err := cursor.All(ctx, &docs); err != nil {
		return Page[DirectJob]{}, err
	}
	rows := make([]DirectJob, 0, len(docs))
	for _, doc := range docs {
		rows = append(rows, doc.view())
	}
	return Page[DirectJob]{Data: rows, Total: total, Page: page, PageSize: size}, nil
}

// DirectJob loads one direct listing and its audit trail.
func (s *Store) DirectJob(ctx context.Context, id string) (DirectJob, error) {
	doc, err := s.direct(ctx, id)
	if err != nil {
		return DirectJob{}, err
	}
	job := doc.view()
	trail, err := s.auditTrail(ctx, doc.Job.ID)
	if err != nil {
		return DirectJob{}, err
	}
	job.Audit = trail
	return job, nil
}

// ReviewDirectJob approves a pending direct job or rejects it to removed or draft.
func (s *Store) ReviewDirectJob(ctx context.Context, id, actor string, input JobReview, now time.Time) (DirectJob, error) {
	if err := input.Normalize(); err != nil {
		return DirectJob{}, err
	}
	doc, err := s.direct(ctx, id)
	if err != nil {
		return DirectJob{}, err
	}
	next, err := ReviewListing(doc.state(), input.Decision, input.Status)
	if err != nil {
		return DirectJob{}, err
	}
	if err := s.writeListing(ctx, doc, next, actor, input.Reason, now); err != nil {
		return DirectJob{}, err
	}
	s.audit(ctx, "job.review."+input.Decision, subjectJob, doc.Job.ID, actor, input.Reason, now.UTC())
	return s.DirectJob(ctx, doc.Job.ID)
}

// TakedownDirectJob hides a live direct job until staff restore it.
func (s *Store) TakedownDirectJob(ctx context.Context, id, actor, reason string, now time.Time) (DirectJob, error) {
	reason, err := NormalizeReason(reason, true)
	if err != nil {
		return DirectJob{}, err
	}
	doc, err := s.direct(ctx, id)
	if err != nil {
		return DirectJob{}, err
	}
	next, err := TakedownListing(doc.state())
	if err != nil {
		return DirectJob{}, err
	}
	if err := s.writeListing(ctx, doc, next, actor, reason, now); err != nil {
		return DirectJob{}, err
	}
	s.audit(ctx, "job.takedown", subjectJob, doc.Job.ID, actor, reason, now.UTC())
	return s.DirectJob(ctx, doc.Job.ID)
}

// RestoreDirectJob undoes a takedown.
func (s *Store) RestoreDirectJob(ctx context.Context, id, actor, reason string, now time.Time) (DirectJob, error) {
	reason, err := NormalizeReason(reason, false)
	if err != nil {
		return DirectJob{}, err
	}
	doc, err := s.direct(ctx, id)
	if err != nil {
		return DirectJob{}, err
	}
	next, err := RestoreListing(doc.state())
	if err != nil {
		return DirectJob{}, err
	}
	if err := s.writeListing(ctx, doc, next, actor, reason, now); err != nil {
		return DirectJob{}, err
	}
	s.audit(ctx, "job.restore", subjectJob, doc.Job.ID, actor, reason, now.UTC())
	return s.DirectJob(ctx, doc.Job.ID)
}

func (s *Store) direct(ctx context.Context, id string) (storedDirect, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return storedDirect{}, ErrNotFound
	}
	var doc storedDirect
	err := s.searchJobs().FindOne(ctx, bson.D{{Key: "job.id", Value: id}}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return storedDirect{}, ErrNotFound
	}
	if err != nil {
		return storedDirect{}, err
	}
	if doc.Source != jobs.DirectSource {
		return storedDirect{}, &ValidationError{Fields: []FieldError{{Field: "id", Detail: "only direct jobs can be reviewed"}}}
	}
	return doc, nil
}

func (s *Store) writeListing(ctx context.Context, doc storedDirect, next ListingState, actor, reason string, now time.Time) error {
	now = now.UTC()
	result, err := s.searchJobs().UpdateOne(ctx, bson.D{
		{Key: "job.id", Value: doc.Job.ID},
		{Key: "source", Value: jobs.DirectSource},
	}, bson.D{{Key: "$set", Value: bson.D{
		{Key: "listingStatus", Value: next.Status},
		{Key: "previousListingStatus", Value: next.Previous},
		{Key: "takedownCause", Value: next.Cause},
		{Key: "reviewNote", Value: reason},
		{Key: "reviewedBy", Value: actor},
		{Key: "reviewedAt", Value: now},
	}}})
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return ErrNotFound
	}
	return s.syncHiring(ctx, doc.Job.ID, next)
}

func (s *Store) syncHiring(ctx context.Context, jobID string, next ListingState) error {
	set := bson.D{{Key: "reviewStatus", Value: next.Status}}
	switch next.Status {
	case jobs.ListingActive:
		set = append(set, bson.E{Key: "status", Value: hiringOpen})
	case jobs.ListingDraft:
		set = append(set, bson.E{Key: "status", Value: hiringDraft})
	}
	_, err := s.hiringJobs().UpdateOne(ctx, bson.D{{Key: "id", Value: jobID}}, bson.D{{Key: "$set", Value: set}})
	return err
}

func (s *Store) releaseCompanyListings(ctx context.Context, companyID, actor, reason string, now time.Time) error {
	now = now.UTC()
	_, err := s.searchJobs().UpdateMany(ctx, bson.D{
		{Key: "source", Value: jobs.DirectSource},
		{Key: "job.companyId", Value: companyID},
		{Key: "listingStatus", Value: jobs.ListingPendingReview},
	}, bson.D{{Key: "$set", Value: bson.D{
		{Key: "listingStatus", Value: jobs.ListingActive},
		{Key: "previousListingStatus", Value: ""},
		{Key: "takedownCause", Value: ""},
		{Key: "reviewNote", Value: reason},
		{Key: "reviewedBy", Value: actor},
		{Key: "reviewedAt", Value: now},
	}}})
	if err != nil {
		return err
	}
	cursor, err := s.searchJobs().Find(ctx, bson.D{
		{Key: "source", Value: jobs.DirectSource},
		{Key: "job.companyId", Value: companyID},
		{Key: "listingStatus", Value: jobs.ListingRemoved},
		{Key: "takedownCause", Value: jobs.TakedownSuspend},
	})
	if err != nil {
		return err
	}
	defer cursor.Close(ctx)
	for cursor.Next(ctx) {
		var doc storedDirect
		if err := cursor.Decode(&doc); err != nil {
			return err
		}
		next, err := RestoreListing(doc.state())
		if err != nil {
			continue
		}
		if next.Status != jobs.ListingActive && next.Status != jobs.ListingPendingReview {
			next.Status = jobs.ListingActive
		}
		if err := s.writeListing(ctx, doc, next, actor, reason, now); err != nil {
			return err
		}
	}
	if err := cursor.Err(); err != nil {
		return err
	}
	_, err = s.hiringJobs().UpdateMany(ctx, bson.D{
		{Key: "companyId", Value: companyID},
		{Key: "status", Value: hiringOpen},
		{Key: "reviewStatus", Value: jobs.ListingPendingReview},
	}, bson.D{{Key: "$set", Value: bson.D{{Key: "reviewStatus", Value: jobs.ListingActive}}}})
	return err
}

func (s *Store) suspendCompanyListings(ctx context.Context, companyID, actor, reason string, now time.Time) error {
	cursor, err := s.searchJobs().Find(ctx, bson.D{
		{Key: "source", Value: jobs.DirectSource},
		{Key: "job.companyId", Value: companyID},
		{Key: "$or", Value: bson.A{
			bson.D{{Key: "listingStatus", Value: jobs.ListingActive}},
			bson.D{{Key: "listingStatus", Value: ""}},
			bson.D{{Key: "listingStatus", Value: bson.D{{Key: "$exists", Value: false}}}},
		}},
	})
	if err != nil {
		return err
	}
	defer cursor.Close(ctx)
	for cursor.Next(ctx) {
		var doc storedDirect
		if err := cursor.Decode(&doc); err != nil {
			return err
		}
		next, err := TakedownListing(doc.state())
		if err != nil {
			continue
		}
		next.Cause = jobs.TakedownSuspend
		if err := s.writeListing(ctx, doc, next, actor, reason, now); err != nil {
			return err
		}
	}
	return cursor.Err()
}

func directFilter(query JobQuery) (bson.D, error) {
	source := strings.TrimSpace(query.Source)
	if source == "" {
		source = jobs.DirectSource
	}
	if source != jobs.DirectSource {
		return nil, &ValidationError{Fields: []FieldError{{Field: "source", Detail: "use direct"}}}
	}
	filter := bson.D{{Key: "source", Value: jobs.DirectSource}}
	status := strings.TrimSpace(query.Status)
	if status == "" {
		status = jobs.ListingPendingReview
	}
	switch status {
	case "all":
	case jobs.ListingPendingReview, jobs.ListingRemoved, jobs.ListingDraft:
		filter = append(filter, bson.E{Key: "listingStatus", Value: status})
	case jobs.ListingActive:
		filter = append(filter, bson.E{Key: "$or", Value: bson.A{
			bson.D{{Key: "listingStatus", Value: jobs.ListingActive}},
			bson.D{{Key: "listingStatus", Value: ""}},
			bson.D{{Key: "listingStatus", Value: bson.D{{Key: "$exists", Value: false}}}},
		}})
	default:
		return nil, &ValidationError{Fields: []FieldError{{Field: "status", Detail: "use pending_review, active, removed, draft, or all"}}}
	}
	q := strings.TrimSpace(query.Q)
	if q == "" {
		return filter, nil
	}
	regex := bson.D{{Key: "$regex", Value: regexp.QuoteMeta(q)}, {Key: "$options", Value: "i"}}
	text := bson.D{{Key: "$or", Value: bson.A{
		bson.D{{Key: "job.title", Value: regex}},
		bson.D{{Key: "job.company", Value: regex}},
	}}}
	return bson.D{{Key: "$and", Value: bson.A{filter, text}}}, nil
}
