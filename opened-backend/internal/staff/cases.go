package staff

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/opened-backend/internal/jobs"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type storedCase struct {
	ID          bson.ObjectID `bson:"_id,omitempty"`
	Queue       string        `bson:"queue"`
	Status      string        `bson:"status"`
	CompanyID   string        `bson:"companyId"`
	Method      string        `bson:"method,omitempty"`
	Domains     []string      `bson:"domains,omitempty"`
	Note        string        `bson:"note,omitempty"`
	RequestedBy string        `bson:"requestedBy,omitempty"`
	SLADueAt    time.Time     `bson:"slaDueAt"`
	CreatedAt   time.Time     `bson:"createdAt"`
	Decision    string        `bson:"decision,omitempty"`
	Reason      string        `bson:"reason,omitempty"`
	DecidedBy   string        `bson:"decidedBy,omitempty"`
	DecidedAt   time.Time     `bson:"decidedAt,omitempty"`
}

func (doc storedCase) view(name string) Case {
	domains := doc.Domains
	if domains == nil {
		domains = []string{}
	}
	return Case{
		ID:          doc.ID.Hex(),
		Queue:       doc.Queue,
		Status:      doc.Status,
		CompanyID:   doc.CompanyID,
		CompanyName: name,
		Method:      doc.Method,
		Domains:     domains,
		Note:        doc.Note,
		RequestedBy: doc.RequestedBy,
		SLADueAt:    doc.SLADueAt,
		CreatedAt:   doc.CreatedAt,
		Decision:    doc.Decision,
		Reason:      doc.Reason,
		DecidedBy:   doc.DecidedBy,
		DecidedAt:   doc.DecidedAt,
	}
}

// CaseQuery filters the moderation queue.
type CaseQuery struct {
	Queue    string
	Status   string
	Page     int64
	PageSize int64
}

// ListCases returns company verification cases.
func (s *Store) ListCases(ctx context.Context, query CaseQuery) (Page[Case], error) {
	page, size := pageBounds(query.Page, query.PageSize)
	filter, err := caseFilter(query)
	if err != nil {
		return Page[Case]{}, err
	}
	total, err := s.cases().CountDocuments(ctx, filter)
	if err != nil {
		return Page[Case]{}, err
	}
	opts := options.Find().
		SetSkip((page - 1) * size).
		SetLimit(size).
		SetSort(bson.D{{Key: "createdAt", Value: 1}})
	cursor, err := s.cases().Find(ctx, filter, opts)
	if err != nil {
		return Page[Case]{}, err
	}
	defer cursor.Close(ctx)
	var docs []storedCase
	if err := cursor.All(ctx, &docs); err != nil {
		return Page[Case]{}, err
	}
	names, err := s.companyNames(ctx, companyIDs(docs))
	if err != nil {
		return Page[Case]{}, err
	}
	rows := make([]Case, 0, len(docs))
	for _, doc := range docs {
		rows = append(rows, doc.view(names[doc.CompanyID]))
	}
	return Page[Case]{Data: rows, Total: total, Page: page, PageSize: size}, nil
}

// Case loads one moderation case.
func (s *Store) Case(ctx context.Context, id string) (Case, error) {
	doc, err := s.caseByID(ctx, id)
	if err != nil {
		return Case{}, err
	}
	names, err := s.companyNames(ctx, []string{doc.CompanyID})
	if err != nil {
		return Case{}, err
	}
	return doc.view(names[doc.CompanyID]), nil
}

// OpenCase files a company verification case. An open case for the company is returned as-is.
func (s *Store) OpenCase(ctx context.Context, actor string, input OpenCase, now time.Time) (Case, bool, error) {
	if err := input.normalize(); err != nil {
		return Case{}, false, err
	}
	doc, created, err := s.openCase(ctx, input, now)
	if err != nil {
		return Case{}, false, err
	}
	if created {
		s.audit(ctx, "company.case.opened", subjectCompany, input.CompanyID, actor, input.Note, now.UTC())
		s.audit(ctx, "case.opened", subjectCase, doc.ID.Hex(), actor, input.Note, now.UTC())
	}
	names, err := s.companyNames(ctx, []string{doc.CompanyID})
	if err != nil {
		return Case{}, created, err
	}
	return doc.view(names[doc.CompanyID]), created, nil
}

// DecideCase applies approve, reject, or suspend to the company on an open case.
func (s *Store) DecideCase(ctx context.Context, id, actor string, input CompanyDecision, now time.Time) (Case, error) {
	if err := input.Normalize(); err != nil {
		return Case{}, err
	}
	doc, err := s.caseByID(ctx, id)
	if err != nil {
		return Case{}, err
	}
	if doc.Status != caseOpen {
		return Case{}, ErrConflict
	}
	if doc.Queue != queueCompanyVerification {
		return Case{}, ErrConflict
	}
	company, err := s.company(ctx, doc.CompanyID)
	if err != nil {
		return Case{}, err
	}
	if _, err := s.applyCompany(ctx, company, actor, input, now); err != nil {
		return Case{}, err
	}
	s.audit(ctx, "case.decision."+input.Decision, subjectCase, doc.ID.Hex(), actor, input.Reason, now.UTC())
	return s.Case(ctx, id)
}

func (input *OpenCase) normalize() error {
	input.CompanyID = strings.TrimSpace(input.CompanyID)
	input.Method = strings.TrimSpace(input.Method)
	input.Note = strings.TrimSpace(input.Note)
	input.RequestedBy = strings.TrimSpace(input.RequestedBy)
	input.Domains = cleanDomains(input.Domains)
	var fields []FieldError
	if input.CompanyID == "" {
		fields = append(fields, FieldError{Field: "company_id", Detail: "company_id is required"})
	}
	if input.Method == "" {
		input.Method = jobs.ClaimManual
	} else if !validClaimMethod(input.Method) {
		fields = append(fields, FieldError{Field: "method", Detail: "use domain_email, dns_txt, or manual"})
	}
	if len([]rune(input.Note)) > maxNote {
		fields = append(fields, FieldError{Field: "note", Detail: "note is too long"})
	}
	if len(fields) > 0 {
		return &ValidationError{Fields: fields}
	}
	return nil
}

func (s *Store) openCase(ctx context.Context, input OpenCase, now time.Time) (storedCase, bool, error) {
	if _, err := s.company(ctx, input.CompanyID); err != nil {
		return storedCase{}, false, err
	}
	var existing storedCase
	err := s.cases().FindOne(ctx, bson.D{
		{Key: "companyId", Value: input.CompanyID},
		{Key: "queue", Value: queueCompanyVerification},
		{Key: "status", Value: caseOpen},
	}).Decode(&existing)
	if err == nil {
		return existing, false, nil
	}
	if !errors.Is(err, mongo.ErrNoDocuments) {
		return storedCase{}, false, err
	}
	now = now.UTC()
	doc := storedCase{
		ID:          bson.NewObjectID(),
		Queue:       queueCompanyVerification,
		Status:      caseOpen,
		CompanyID:   input.CompanyID,
		Method:      input.Method,
		Domains:     input.Domains,
		Note:        input.Note,
		RequestedBy: input.RequestedBy,
		SLADueAt:    now.Add(verificationSLA),
		CreatedAt:   now,
	}
	if doc.Domains == nil {
		doc.Domains = []string{}
	}
	if _, err := s.cases().InsertOne(ctx, doc); err != nil {
		return storedCase{}, false, err
	}
	return doc, true, nil
}

func (s *Store) caseByID(ctx context.Context, id string) (storedCase, error) {
	objectID, err := bson.ObjectIDFromHex(strings.TrimSpace(id))
	if err != nil {
		return storedCase{}, ErrNotFound
	}
	var doc storedCase
	err = s.cases().FindOne(ctx, bson.D{{Key: "_id", Value: objectID}}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return storedCase{}, ErrNotFound
	}
	if err != nil {
		return storedCase{}, err
	}
	return doc, nil
}

func (s *Store) casesForCompany(ctx context.Context, companyID string) ([]Case, error) {
	cursor, err := s.cases().Find(ctx, bson.D{{Key: "companyId", Value: companyID}},
		options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(caseHistory))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var docs []storedCase
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	names, err := s.companyNames(ctx, []string{companyID})
	if err != nil {
		return nil, err
	}
	rows := make([]Case, 0, len(docs))
	for _, doc := range docs {
		rows = append(rows, doc.view(names[companyID]))
	}
	return rows, nil
}

func (s *Store) closeOpenCases(ctx context.Context, companyID, decision, reason, actor string, now time.Time) error {
	_, err := s.cases().UpdateMany(ctx, bson.D{
		{Key: "companyId", Value: companyID},
		{Key: "queue", Value: queueCompanyVerification},
		{Key: "status", Value: caseOpen},
	}, bson.D{{Key: "$set", Value: bson.D{
		{Key: "status", Value: caseDecided},
		{Key: "decision", Value: decision},
		{Key: "reason", Value: reason},
		{Key: "decidedBy", Value: actor},
		{Key: "decidedAt", Value: now.UTC()},
	}}})
	return err
}

func (s *Store) companyNames(ctx context.Context, ids []string) (map[string]string, error) {
	names := map[string]string{}
	if len(ids) == 0 {
		return names, nil
	}
	cursor, err := s.companiesColl().Find(ctx, bson.D{{Key: "id", Value: bson.D{{Key: "$in", Value: ids}}}},
		options.Find().SetProjection(bson.D{
			{Key: "id", Value: 1},
			{Key: "companyName", Value: 1},
			{Key: "overrides.name", Value: 1},
		}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	for cursor.Next(ctx) {
		var doc companyDoc
		if err := cursor.Decode(&doc); err != nil {
			return nil, err
		}
		names[doc.ID] = doc.name()
	}
	return names, cursor.Err()
}

func companyIDs(docs []storedCase) []string {
	seen := map[string]struct{}{}
	ids := make([]string, 0, len(docs))
	for _, doc := range docs {
		if _, ok := seen[doc.CompanyID]; ok {
			continue
		}
		seen[doc.CompanyID] = struct{}{}
		ids = append(ids, doc.CompanyID)
	}
	return ids
}

func caseFilter(query CaseQuery) (bson.D, error) {
	queue := strings.TrimSpace(query.Queue)
	if queue == "" {
		queue = queueCompanyVerification
	}
	if queue != queueCompanyVerification {
		return nil, &ValidationError{Fields: []FieldError{{Field: "queue", Detail: "use company_verification"}}}
	}
	filter := bson.D{{Key: "queue", Value: queue}}
	status := strings.TrimSpace(query.Status)
	switch status {
	case "":
	case caseOpen, caseDecided:
		filter = append(filter, bson.E{Key: "status", Value: status})
	default:
		return nil, &ValidationError{Fields: []FieldError{{Field: "status", Detail: "use open or decided"}}}
	}
	return filter, nil
}
