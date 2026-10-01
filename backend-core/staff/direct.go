package staff

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"github.com/sid0709/OpenSeat/backend-core/jobschema"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// JobQuery is GET /v1/admin/jobs.
type JobQuery struct {
	Source   string
	Status   string
	Page     int64
	PageSize int64
}

type hiringJob struct {
	ID                 string                   `bson:"id"`
	CompanyID          string                   `bson:"companyId"`
	CreatedBy          string                   `bson:"createdBy"`
	Title              string                   `bson:"title"`
	Team               string                   `bson:"team"`
	Seniority          string                   `bson:"seniority"`
	Location           string                   `bson:"location"`
	Workplace          string                   `bson:"workplace"`
	PayMin             int                      `bson:"payMin"`
	PayMax             int                      `bson:"payMax"`
	Currency           string                   `bson:"currency"`
	Visa               bool                     `bson:"visa"`
	Summary            string                   `bson:"summary"`
	Skills             []string                 `bson:"skills"`
	Responsibilities   []string                 `bson:"responsibilities"`
	Requirements       []string                 `bson:"requirements"`
	Description        string                   `bson:"description"`
	ScreeningQuestions []jobs.ScreeningQuestion `bson:"screeningQuestions,omitempty"`
	Status             string                   `bson:"status"`
	CreatedAt          time.Time                `bson:"createdAt"`
	PostedAt           time.Time                `bson:"postedAt,omitempty"`
}

// ListDirectJobs returns hiring jobs. source=direct is this collection; any other source is empty.
func (s *Store) ListDirectJobs(ctx context.Context, query JobQuery) (JobList, error) {
	page, size := pageBounds(query.Page, query.PageSize)
	source := strings.TrimSpace(query.Source)
	if source != "" && source != jobs.DirectSource {
		return JobList{Jobs: []DirectJob{}, Total: 0}, nil
	}
	filter, err := jobStatusFilter(query.Status)
	if err != nil {
		return JobList{}, err
	}
	total, err := s.hiringJobs().CountDocuments(ctx, filter)
	if err != nil {
		return JobList{}, err
	}
	cursor, err := s.hiringJobs().Find(ctx, filter, findPage(page, size))
	if err != nil {
		return JobList{}, err
	}
	defer cursor.Close(ctx)
	docs := []hiringJob{}
	if err := cursor.All(ctx, &docs); err != nil {
		return JobList{}, err
	}
	ids := make([]string, len(docs))
	for i, doc := range docs {
		ids[i] = doc.CompanyID
	}
	names, err := s.companyNames(ctx, ids)
	if err != nil {
		return JobList{}, err
	}
	rows := make([]DirectJob, 0, len(docs))
	for _, doc := range docs {
		rows = append(rows, viewDirectJob(doc, names[doc.CompanyID]))
	}
	return JobList{Jobs: rows, Total: total, Next: nextPage(page, size, total)}, nil
}

// ReviewDirectJob approves a pending or removed job onto search, or rejects a pending job off search.
func (s *Store) ReviewDirectJob(ctx context.Context, id, actor string, input JobReview, now time.Time) (JobResult, error) {
	if err := input.Normalize(); err != nil {
		return JobResult{}, err
	}
	doc, err := s.hiringJob(ctx, id)
	if err != nil {
		return JobResult{}, err
	}
	next, err := ReviewJob(doc.Status, input.Decision, input.RejectDisposition)
	if err != nil {
		return JobResult{}, err
	}
	now = now.UTC()
	if err := s.requireListings(); err != nil {
		return JobResult{}, err
	}
	if next == jobs.JobOpen {
		if err := s.publish(ctx, doc, now); err != nil {
			return JobResult{}, err
		}
	} else if err := s.listings.RemoveDirectJob(ctx, doc.ID); err != nil {
		return JobResult{}, err
	}
	if err := s.setHiringStatus(ctx, doc, next, now); err != nil {
		return JobResult{}, err
	}
	doc.Status = next
	if next == jobs.JobOpen && doc.PostedAt.IsZero() {
		doc.PostedAt = now
	}
	auditID, err := s.audit(ctx, "direct_job."+input.Decision, subjectJob, doc.ID, actor, input.Reason, now)
	if err != nil {
		return JobResult{}, err
	}
	name, err := s.oneCompanyName(ctx, doc.CompanyID)
	if err != nil {
		return JobResult{}, err
	}
	return JobResult{Job: viewDirectJob(doc, name), AuditID: auditID}, nil
}

// TakedownDirectJob removes a live or pending direct job from search. Approve publishes it again.
func (s *Store) TakedownDirectJob(ctx context.Context, id, actor, reason string, now time.Time) (JobResult, error) {
	reason, err := NormalizeReason(reason, true)
	if err != nil {
		return JobResult{}, err
	}
	doc, err := s.hiringJob(ctx, id)
	if err != nil {
		return JobResult{}, err
	}
	if _, err := TakedownJob(doc.Status); err != nil {
		return JobResult{}, err
	}
	now = now.UTC()
	if err := s.requireListings(); err != nil {
		return JobResult{}, err
	}
	if err := s.listings.RemoveDirectJob(ctx, doc.ID); err != nil {
		return JobResult{}, err
	}
	if err := s.setHiringStatus(ctx, doc, jobs.JobRemoved, now); err != nil {
		return JobResult{}, err
	}
	doc.Status = jobs.JobRemoved
	auditID, err := s.audit(ctx, "direct_job.takedown", subjectJob, doc.ID, actor, reason, now)
	if err != nil {
		return JobResult{}, err
	}
	name, err := s.oneCompanyName(ctx, doc.CompanyID)
	if err != nil {
		return JobResult{}, err
	}
	return JobResult{Job: viewDirectJob(doc, name), AuditID: auditID}, nil
}

func (s *Store) publish(ctx context.Context, doc hiringJob, now time.Time) error {
	if err := s.requireListings(); err != nil {
		return err
	}
	name, err := s.oneCompanyName(ctx, doc.CompanyID)
	if err != nil {
		return err
	}
	return s.listings.UpsertDirectJob(ctx, searchJob(doc, name), doc.CreatedBy, now)
}

func (s *Store) requireListings() error {
	if s.listings == nil {
		return errors.New("search is unavailable")
	}
	return nil
}

func (s *Store) setHiringStatus(ctx context.Context, doc hiringJob, status string, now time.Time) error {
	set := bson.D{
		{Key: "status", Value: status},
		{Key: "updatedAt", Value: now},
	}
	if status == jobs.JobOpen && doc.PostedAt.IsZero() {
		set = append(set, bson.E{Key: "postedAt", Value: now})
	}
	_, err := s.hiringJobs().UpdateOne(ctx, bson.D{{Key: "id", Value: doc.ID}}, bson.D{{Key: "$set", Value: set}})
	return err
}

func (s *Store) hiringJob(ctx context.Context, id string) (hiringJob, error) {
	var doc hiringJob
	err := s.hiringJobs().FindOne(ctx, bson.D{{Key: "id", Value: id}}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return hiringJob{}, ErrNotFound
	}
	return doc, err
}

func (s *Store) oneCompanyName(ctx context.Context, id string) (string, error) {
	names, err := s.companyNames(ctx, []string{id})
	if err != nil {
		return "", err
	}
	return names[id], nil
}

func viewDirectJob(doc hiringJob, companyName string) DirectJob {
	return DirectJob{
		ID:          doc.ID,
		Title:       doc.Title,
		CompanyID:   doc.CompanyID,
		CompanyName: companyName,
		Source:      jobs.DirectSource,
		Status:      doc.Status,
		PostedAt:    timePtr(doc.PostedAt),
		CreatedAt:   doc.CreatedAt,
		Location:    doc.Location,
	}
}

func searchJob(doc hiringJob, companyName string) jobs.SearchJob {
	return jobs.SearchJob{
		ID:                 doc.ID,
		Title:              doc.Title,
		Company:            companyName,
		CompanyID:          doc.CompanyID,
		Location:           doc.Location,
		Workplace:          doc.Workplace,
		Pay:                jobs.Pay{Min: doc.PayMin, Max: doc.PayMax, Currency: jobschema.CanonicalCurrency(doc.Currency), Period: jobschema.PayYear},
		Seniority:          doc.Seniority,
		Employment:         jobschema.EmploymentFullTime,
		Source:             jobs.DirectSource,
		Visa:               doc.Visa,
		Team:               doc.Team,
		Skills:             listOrEmpty(doc.Skills),
		Summary:            doc.Summary,
		Responsibilities:   listOrEmpty(doc.Responsibilities),
		Requirements:       listOrEmpty(doc.Requirements),
		Benefits:           []string{},
		Description:        doc.Description,
		ScreeningQuestions: questionsOrEmpty(doc.ScreeningQuestions),
	}
}

func questionsOrEmpty(items []jobs.ScreeningQuestion) []jobs.ScreeningQuestion {
	if items == nil {
		return []jobs.ScreeningQuestion{}
	}
	return items
}

func listOrEmpty(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}

func jobStatusFilter(status string) (bson.D, error) {
	status = strings.TrimSpace(status)
	if status == "" {
		return bson.D{}, nil
	}
	switch status {
	case jobs.JobOpen, jobs.JobPaused, jobs.JobDraft, jobs.JobClosed, jobs.JobPendingReview, jobs.JobRemoved:
		return bson.D{{Key: "status", Value: status}}, nil
	default:
		return nil, &ValidationError{Fields: []FieldError{{Field: "status", Detail: "use open, paused, draft, closed, pending_review, or removed"}}}
	}
}

func findPage(page, size int64) *options.FindOptionsBuilder {
	return options.Find().
		SetSkip((page - 1) * size).
		SetLimit(size).
		SetSort(bson.D{{Key: "createdAt", Value: 1}})
}
