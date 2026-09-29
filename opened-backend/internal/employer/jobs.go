package employer

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/opened-backend/internal/auth"
	"github.com/sid0709/OpenSeat/opened-backend/internal/jobs"
	"github.com/sid0709/OpenSeat/opened-backend/internal/jobschema"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	statusOpen   = "open"
	statusPaused = "paused"
	statusDraft  = "draft"
	statusClosed = "closed"

	policyAccept = "accept"
	policyCap    = "cap"
	policyDirect = "direct"

	minDailyCap = 1
	maxDailyCap = 100
)

func (s *Store) ListJobs(ctx context.Context, companyID string) ([]Job, error) {
	docs, err := s.jobsFor(ctx, companyID)
	if err != nil {
		return nil, err
	}
	pipelines, err := s.pipelines(ctx, companyID)
	if err != nil {
		return nil, err
	}
	out := make([]Job, 0, len(docs))
	for _, doc := range docs {
		out = append(out, viewJob(doc, pipelines[doc.ID]))
	}
	return out, nil
}

func (s *Store) GetJob(ctx context.Context, companyID, id string) (Job, error) {
	doc, err := s.job(ctx, companyID, id)
	if err != nil {
		return Job{}, err
	}
	pipelines, err := s.pipelines(ctx, companyID)
	if err != nil {
		return Job{}, err
	}
	return viewJob(doc, pipelines[doc.ID]), nil
}

func (s *Store) CreateJob(ctx context.Context, company auth.Company, userID string, input JobInput, now time.Time) (Job, error) {
	doc, err := normalizeJob(input, now)
	if err != nil {
		return Job{}, err
	}
	id, err := newID()
	if err != nil {
		return Job{}, err
	}
	doc.ID = id
	doc.CompanyID = company.ID
	doc.CreatedBy = userID
	if doc.Status == statusOpen {
		if err := s.jobs.UpsertDirectJob(ctx, searchJob(doc, company.Name), userID, now); err != nil {
			return Job{}, err
		}
		doc.PostedAt = now.UTC()
	}
	if _, err := s.collection(jobsCollection).InsertOne(ctx, doc); err != nil {
		return Job{}, err
	}
	verb := "saved a draft"
	tone := "neutral"
	if doc.Status == statusOpen {
		verb = "published"
		tone = "success"
	}
	if err := s.record(ctx, company.ID, doc.Title+" "+verb, doc.Location, tone, now); err != nil {
		return Job{}, err
	}
	if err := s.ensureTeam(ctx, company.ID, doc.Team); err != nil {
		return Job{}, err
	}
	return viewJob(doc, Pipeline{}), nil
}

func (s *Store) UpdateJob(ctx context.Context, company auth.Company, userID, id string, input JobInput, now time.Time) (Job, error) {
	existing, err := s.job(ctx, company.ID, id)
	if err != nil {
		return Job{}, err
	}
	if existing.Status == statusClosed {
		return Job{}, ErrConflict
	}
	doc, err := normalizeJob(input, now)
	if err != nil {
		return Job{}, err
	}
	doc.ID = existing.ID
	doc.CompanyID = existing.CompanyID
	doc.CreatedBy = existing.CreatedBy
	doc.CreatedAt = existing.CreatedAt
	doc.Views = existing.Views
	doc.PostedAt = existing.PostedAt
	doc.UpdatedAt = now.UTC()
	if doc.Status == statusOpen {
		if err := s.jobs.UpsertDirectJob(ctx, searchJob(doc, company.Name), userID, now); err != nil {
			return Job{}, err
		}
		if doc.PostedAt.IsZero() {
			doc.PostedAt = now.UTC()
		}
	} else if existing.Status == statusOpen {
		if err := s.jobs.RemoveDirectJob(ctx, doc.ID); err != nil {
			return Job{}, err
		}
	}
	if _, err := s.collection(jobsCollection).ReplaceOne(ctx, bson.D{{Key: "id", Value: id}, {Key: "companyId", Value: company.ID}}, doc); err != nil {
		return Job{}, err
	}
	if err := s.record(ctx, company.ID, doc.Title+" updated", doc.Location, "neutral", now); err != nil {
		return Job{}, err
	}
	if err := s.ensureTeam(ctx, company.ID, doc.Team); err != nil {
		return Job{}, err
	}
	pipelines, err := s.pipelines(ctx, company.ID)
	if err != nil {
		return Job{}, err
	}
	return viewJob(doc, pipelines[doc.ID]), nil
}

func (s *Store) SetJobStatus(ctx context.Context, company auth.Company, userID, id, status string, now time.Time) (Job, error) {
	doc, err := s.job(ctx, company.ID, id)
	if err != nil {
		return Job{}, err
	}
	if !validStatus(status) || status == doc.Status {
		return Job{}, ErrInvalidInput
	}
	if doc.Status == statusClosed {
		return Job{}, ErrConflict
	}
	if status == statusOpen {
		if err := readyToPublish(doc); err != nil {
			return Job{}, err
		}
		if err := s.jobs.UpsertDirectJob(ctx, searchJob(doc, company.Name), userID, now); err != nil {
			return Job{}, err
		}
		if doc.PostedAt.IsZero() {
			doc.PostedAt = now.UTC()
		}
	} else if err := s.jobs.RemoveDirectJob(ctx, doc.ID); err != nil {
		return Job{}, err
	}
	doc.Status = status
	doc.UpdatedAt = now.UTC()
	if _, err := s.collection(jobsCollection).ReplaceOne(ctx, bson.D{{Key: "id", Value: id}, {Key: "companyId", Value: company.ID}}, doc); err != nil {
		return Job{}, err
	}
	if err := s.record(ctx, company.ID, doc.Title+" is "+status, "", toneForStatus(status), now); err != nil {
		return Job{}, err
	}
	pipelines, err := s.pipelines(ctx, company.ID)
	if err != nil {
		return Job{}, err
	}
	return viewJob(doc, pipelines[doc.ID]), nil
}

func (s *Store) jobsFor(ctx context.Context, companyID string) ([]storedJob, error) {
	cursor, err := s.collection(jobsCollection).Find(ctx, bson.D{{Key: "companyId", Value: companyID}}, options.Find().SetSort(bson.D{{Key: "updatedAt", Value: -1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	docs := []storedJob{}
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	return docs, nil
}

func (s *Store) job(ctx context.Context, companyID, id string) (storedJob, error) {
	var doc storedJob
	err := s.collection(jobsCollection).FindOne(ctx, bson.D{{Key: "id", Value: id}, {Key: "companyId", Value: companyID}}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return storedJob{}, ErrNotFound
	}
	return doc, err
}

func normalizeJob(input JobInput, now time.Time) (storedJob, error) {
	title := strings.TrimSpace(input.Title)
	if title == "" || len([]rune(title)) > 120 {
		return storedJob{}, ErrInvalidInput
	}
	status := input.Status
	if status == "" {
		status = statusDraft
	}
	if !validStatus(status) || status == statusClosed {
		return storedJob{}, ErrInvalidInput
	}
	policy := input.Policy
	if policy == "" {
		policy = policyAccept
	}
	if policy != policyAccept && policy != policyCap && policy != policyDirect {
		return storedJob{}, ErrInvalidInput
	}
	dailyCap := 0
	if input.DailyCap >= minDailyCap && input.DailyCap <= maxDailyCap {
		dailyCap = input.DailyCap
	} else if policy == policyCap {
		return storedJob{}, ErrInvalidInput
	}
	workplace := input.Workplace
	if workplace == "" {
		workplace = jobschema.WorkplaceHybrid
	}
	if !oneOf(workplace, jobschema.Workplaces()) {
		return storedJob{}, ErrInvalidInput
	}
	seniority := input.Seniority
	if seniority == "" {
		seniority = jobschema.SeniorityMiddle
	}
	if !oneOf(seniority, jobschema.Seniorities()) {
		return storedJob{}, ErrInvalidInput
	}
	skills := compactList(input.Skills, 12, 40)
	doc := storedJob{
		Title:            title,
		Team:             clip(input.Team, 80),
		Seniority:        seniority,
		Location:         clip(input.Location, 120),
		Workplace:        workplace,
		PayMin:           input.PayMin,
		PayMax:           input.PayMax,
		Currency:         jobschema.CanonicalCurrency(input.Currency),
		Visa:             input.Visa,
		Summary:          clip(input.Summary, 2000),
		Skills:           skills,
		Responsibilities: compactList(input.Responsibilities, 6, 120),
		Requirements:     compactList(input.Requirements, 6, 120),
		Description:      clip(input.Description, 12000),
		Policy:           policy,
		DailyCap:         dailyCap,
		Status:           status,
		CreatedAt:        now.UTC(),
		UpdatedAt:        now.UTC(),
	}
	if status == statusOpen {
		if err := readyToPublish(doc); err != nil {
			return storedJob{}, err
		}
	}
	return doc, nil
}

func readyToPublish(doc storedJob) error {
	if doc.Title == "" || doc.Location == "" || doc.Summary == "" || doc.PayMin <= 0 || doc.PayMax < doc.PayMin || len(doc.Skills) < publishSkillMinimum {
		return ErrInvalidInput
	}
	return nil
}

func searchJob(doc storedJob, companyName string) jobs.SearchJob {
	return jobs.SearchJob{
		ID:               doc.ID,
		Title:            doc.Title,
		Company:          companyName,
		CompanyID:        doc.CompanyID,
		Location:         doc.Location,
		Workplace:        doc.Workplace,
		Pay:              jobs.Pay{Min: doc.PayMin, Max: doc.PayMax, Currency: jobschema.CanonicalCurrency(doc.Currency), Period: jobschema.PayYear},
		Seniority:        doc.Seniority,
		Employment:       jobschema.EmploymentFullTime,
		Source:           "direct",
		Visa:             doc.Visa,
		Team:             doc.Team,
		Skills:           listOrEmpty(doc.Skills),
		Summary:          doc.Summary,
		Responsibilities: listOrEmpty(doc.Responsibilities),
		Requirements:     listOrEmpty(doc.Requirements),
		Benefits:         []string{},
		Description:      doc.Description,
	}
}

func viewJob(doc storedJob, pipeline Pipeline) Job {
	posted := doc.PostedAt
	if posted.IsZero() {
		posted = doc.CreatedAt
	}
	job := Job{
		ID:               doc.ID,
		Title:            doc.Title,
		Team:             doc.Team,
		Location:         doc.Location,
		Workplace:        doc.Workplace,
		Seniority:        doc.Seniority,
		Status:           doc.Status,
		PostedOn:         posted,
		Views:            doc.Views,
		Pipeline:         pipeline,
		Policy:           doc.Policy,
		DailyCap:         doc.DailyCap,
		PayMin:           doc.PayMin,
		PayMax:           doc.PayMax,
		Currency:         jobschema.CanonicalCurrency(doc.Currency),
		Visa:             doc.Visa,
		Summary:          doc.Summary,
		Skills:           listOrEmpty(doc.Skills),
		Responsibilities: listOrEmpty(doc.Responsibilities),
		Requirements:     listOrEmpty(doc.Requirements),
		Description:      doc.Description,
	}
	if doc.Status == statusOpen {
		job.JobID = doc.ID
	}
	return job
}

func validStatus(status string) bool {
	switch status {
	case statusOpen, statusPaused, statusDraft, statusClosed:
		return true
	default:
		return false
	}
}

func toneForStatus(status string) string {
	switch status {
	case statusOpen:
		return "success"
	case statusPaused, statusClosed:
		return "warning"
	default:
		return "neutral"
	}
}

func oneOf(value string, allowed []string) bool {
	for _, item := range allowed {
		if item == value {
			return true
		}
	}
	return false
}

func compact(values []string, limit int) []string {
	return compactList(values, limit, 40)
}

func compactList(values []string, limit, itemRunes int) []string {
	out := make([]string, 0, min(len(values), limit))
	seen := map[string]struct{}{}
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		value = clip(value, itemRunes)
		key := strings.ToLower(value)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, value)
		if len(out) == limit {
			break
		}
	}
	return out
}

func listOrEmpty(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}

func clip(value string, limit int) string {
	value = strings.TrimSpace(value)
	if len([]rune(value)) <= limit {
		return value
	}
	return string([]rune(value)[:limit])
}
