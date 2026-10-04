package jobs

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// ExternalAnalysisModel is stored on records an external analyzer writes back.
const ExternalAnalysisModel = "postman"

var (
	// ErrAlreadyAnalyzed means the company or temp job already has an analysis result.
	ErrAlreadyAnalyzed = errors.New("already analyzed")
)

// StoredDocumentList is one page of full Mongo documents as JSON.
type StoredDocumentList struct {
	Items    []json.RawMessage `json:"items"`
	Total    int64             `json:"total"`
	Page     int64             `json:"page"`
	PageSize int64             `json:"pageSize"`
}

// ListUnanalyzedTempJobs returns temp jobs that still need analysis, with every stored field.
func (s *Store) ListUnanalyzedTempJobs(ctx context.Context, query ListQuery) (StoredDocumentList, error) {
	filter, err := s.unanalyzedTempJobFilter(ctx, query.Q)
	if err != nil {
		return StoredDocumentList{}, err
	}
	sort := bson.D{{Key: "postedAt", Value: -1}, {Key: "_id", Value: -1}}
	return s.listFullDocuments(ctx, s.dest(), filter, query, sort)
}

// ListUnanalyzedCompanies returns staged companies research has not tried yet, with every stored field.
func (s *Store) ListUnanalyzedCompanies(ctx context.Context, query ListQuery) (StoredDocumentList, error) {
	filter := unanalyzedCompanyFilter(query.Q)
	sort := bson.D{{Key: "jobCount", Value: -1}, {Key: "companyName", Value: 1}, {Key: "id", Value: 1}}
	return s.listFullDocuments(ctx, s.stagedCompanies(), filter, query, sort)
}

func (s *Store) listFullDocuments(ctx context.Context, coll *mongo.Collection, filter bson.D, query ListQuery, sort bson.D) (StoredDocumentList, error) {
	total, err := coll.CountDocuments(ctx, filter)
	if err != nil {
		return StoredDocumentList{}, err
	}
	opts := options.Find().
		SetSkip((query.Page - 1) * query.PageSize).
		SetLimit(query.PageSize).
		SetSort(sort)
	cursor, err := coll.Find(ctx, filter, opts)
	if err != nil {
		return StoredDocumentList{}, err
	}
	defer cursor.Close(ctx)

	var docs []bson.M
	if err := cursor.All(ctx, &docs); err != nil {
		return StoredDocumentList{}, err
	}
	items := make([]json.RawMessage, 0, len(docs))
	for _, doc := range docs {
		raw, err := documentJSON(doc)
		if err != nil {
			return StoredDocumentList{}, err
		}
		items = append(items, raw)
	}
	return StoredDocumentList{
		Items:    items,
		Total:    total,
		Page:     query.Page,
		PageSize: query.PageSize,
	}, nil
}

func (s *Store) unanalyzedTempJobFilter(ctx context.Context, q string) (bson.D, error) {
	filter := listFilter(q)
	filter = append(filter, bson.E{Key: notPublishableField, Value: bson.D{{Key: "$exists", Value: false}}})
	analyzed, err := s.analyzedObjectIDs(ctx)
	if err != nil {
		return nil, err
	}
	if len(analyzed) > 0 {
		filter = append(filter, bson.E{Key: "_id", Value: bson.D{{Key: "$nin", Value: analyzed}}})
	}
	return filter, nil
}

func unanalyzedCompanyFilter(q string) bson.D {
	filter := bson.D{{Key: researchedAtField, Value: bson.D{{Key: "$exists", Value: false}}}}
	if pattern := searchPattern(q); pattern != "" {
		regex := bson.D{{Key: "$regex", Value: pattern}, {Key: "$options", Value: "i"}}
		filter = append(filter, bson.E{Key: "$or", Value: bson.A{
			bson.D{{Key: "companyName", Value: regex}},
			bson.D{{Key: "overrides.name", Value: regex}},
			bson.D{{Key: "companyUrl", Value: regex}},
			bson.D{{Key: "overrides.url", Value: regex}},
			bson.D{{Key: "id", Value: regex}},
		}})
	}
	return filter
}

// SubmitExternalJobAnalysis stores a caller-provided search record for one temp job.
func (s *Store) SubmitExternalJobAnalysis(ctx context.Context, tempJobID string, record SearchRecord, now time.Time) (SearchRecord, error) {
	id, err := bson.ObjectIDFromHex(tempJobID)
	if err != nil {
		return SearchRecord{}, ErrInvalidID
	}
	if strings.TrimSpace(record.TempJobID) != tempJobID {
		return SearchRecord{}, fmt.Errorf("%w: tempJobId must match the route", ErrInvalidInput)
	}
	if err := validateSubmittedSearchRecord(record); err != nil {
		return SearchRecord{}, err
	}
	listing, err := s.tempListing(ctx, id)
	if err != nil {
		return SearchRecord{}, err
	}
	if analyzed, err := s.tempJobAnalyzed(ctx, id); err != nil {
		return SearchRecord{}, err
	} else if analyzed {
		return SearchRecord{}, ErrAlreadyAnalyzed
	}
	if !publishable(record.Job) {
		return SearchRecord{}, fmt.Errorf("%w: analysis is too thin to publish", ErrInvalidInput)
	}
	analyzedAt := record.AnalyzedAt
	if analyzedAt.IsZero() {
		analyzedAt = now.UTC()
	}
	model := strings.TrimSpace(record.Model)
	if model == "" {
		model = ExternalAnalysisModel
	}
	applyLink := strings.TrimSpace(record.ApplyLink)
	if applyLink == "" {
		applyLink = listing.ApplyLink
	}
	createdBy := strings.TrimSpace(record.CreatedBy)
	if createdBy == "" {
		createdBy = strings.TrimSpace(listing.CreatedBy)
	}
	source := strings.TrimSpace(record.Source)
	if source == "" {
		source = strings.TrimSpace(listing.Source)
	}
	doc := storedSearchJob{
		ID:            id,
		TempJobID:     tempJobID,
		PostedAt:      listing.PostedAt,
		ApplyLink:     applyLink,
		AnalyzedAt:    analyzedAt.UTC(),
		Model:         model,
		CreatedBy:     createdBy,
		Source:        source,
		SourceRef:     strings.TrimSpace(listing.SourceRef),
		ListingStatus: strings.TrimSpace(record.ListingStatus),
		Job:           record.Job,
	}
	if err := s.saveSearchJob(ctx, doc); err != nil {
		return SearchRecord{}, err
	}
	_, err = s.dest().UpdateOne(ctx, bson.D{{Key: "_id", Value: id}}, bson.D{{Key: "$unset", Value: bson.D{{Key: "analysis", Value: ""}}}})
	if err != nil {
		return SearchRecord{}, err
	}
	return doc.view(now), nil
}

func (s *Store) tempJobAnalyzed(ctx context.Context, id bson.ObjectID) (bool, error) {
	count, err := s.structured().CountDocuments(ctx, bson.D{{Key: "_id", Value: id}})
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// SubmitExternalCompanyAnalysis stores caller-provided company research for one staged company.
func (s *Store) SubmitExternalCompanyAnalysis(ctx context.Context, companyID string, input CompanyResearch, now time.Time) error {
	companyID = strings.TrimSpace(companyID)
	if companyID == "" {
		return ErrInvalidInput
	}
	if err := validateSubmittedCompanyResearch(input); err != nil {
		return err
	}
	var doc struct {
		storedCompany `bson:",inline"`
		Research      struct {
			At *time.Time `bson:"at"`
		} `bson:"research"`
	}
	err := s.stagedCompanies().FindOne(ctx, bson.D{{Key: "id", Value: companyID}}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if doc.Research.At != nil {
		return ErrAlreadyAnalyzed
	}
	stored := doc.storedCompany
	filter := bson.D{{Key: "id", Value: companyID}}
	stamp := bson.D{
		{Key: researchedAtField, Value: now.UTC()},
		{Key: "research.model", Value: ExternalAnalysisModel},
		{Key: "research.sources", Value: input.Sources},
	}
	if !foundProfile(input.Company) {
		set := append(stamp, bson.E{Key: researchFoundField, Value: false})
		_, err := s.stagedCompanies().UpdateOne(ctx, filter, bson.D{{Key: "$set", Value: set}})
		return err
	}
	set := append(researchFill(stored, input.Company), stamp...)
	set = append(set, bson.E{Key: researchFoundField, Value: true})
	var researched bson.D
	err = s.stagedCompanies().FindOneAndUpdate(ctx, filter, bson.D{{Key: "$set", Value: set}},
		options.FindOneAndUpdate().SetReturnDocument(options.After)).Decode(&researched)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	return s.publishStaged(ctx, researched)
}

// StagedCompanyDeletion is what the public analyzer delete route returns.
type StagedCompanyDeletion struct {
	CompanyID string `json:"companyId"`
	Removed   struct {
		Company    bool     `json:"company"`
		TempJobs   []string `json:"tempJobs"`
		SearchJobs []string `json:"searchJobs"`
	} `json:"removed"`
}

// DeleteStagedCompanyForAnalyzer removes one staged company and every temp or search job tied to it.
func (s *Store) DeleteStagedCompanyForAnalyzer(ctx context.Context, companyID string) (StagedCompanyDeletion, error) {
	companyID = strings.TrimSpace(companyID)
	if companyID == "" {
		return StagedCompanyDeletion{}, ErrInvalidInput
	}
	var staged storedCompany
	err := s.stagedCompanies().FindOne(ctx, bson.D{{Key: "id", Value: companyID}}).Decode(&staged)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return StagedCompanyDeletion{}, ErrNotFound
	}
	if err != nil {
		return StagedCompanyDeletion{}, err
	}

	tempFilter := stagedCompanyTempJobFilter(companyID, staged.SourceID)
	tempIDs, err := s.findTempJobIDs(ctx, tempFilter)
	if err != nil {
		return StagedCompanyDeletion{}, err
	}
	searchJobIDs, err := s.deleteSearchJobs(ctx, structuredJobsForStagedCompanyFilter(companyID, tempIDs))
	if err != nil {
		return StagedCompanyDeletion{}, err
	}
	tempJobIDs, err := s.deleteTempJobsByFilter(ctx, tempFilter, tempIDs)
	if err != nil {
		return StagedCompanyDeletion{}, err
	}
	removed, err := s.stagedCompanies().DeleteOne(ctx, bson.D{{Key: "id", Value: companyID}})
	if err != nil {
		return StagedCompanyDeletion{}, err
	}

	var result StagedCompanyDeletion
	result.CompanyID = companyID
	result.Removed.Company = removed.DeletedCount > 0
	result.Removed.TempJobs = tempJobIDs
	result.Removed.SearchJobs = searchJobIDs
	return result, nil
}

func stagedCompanyTempJobFilter(publicID, sourceID string) bson.D {
	clauses := bson.A{
		bson.D{{Key: "companyPublicId", Value: publicID}},
	}
	if oid, err := bson.ObjectIDFromHex(strings.TrimSpace(sourceID)); err == nil {
		clauses = append(clauses, bson.D{{Key: "companyId", Value: oid}})
	}
	if len(clauses) == 1 {
		return clauses[0].(bson.D)
	}
	return bson.D{{Key: "$or", Value: clauses}}
}

func structuredJobsForStagedCompanyFilter(publicID string, tempIDs []bson.ObjectID) bson.D {
	clauses := bson.A{
		bson.D{{Key: "job.companyId", Value: publicID}},
	}
	if len(tempIDs) > 0 {
		clauses = append(clauses, bson.D{{Key: "_id", Value: bson.D{{Key: "$in", Value: tempIDs}}}})
	}
	if len(clauses) == 1 {
		return clauses[0].(bson.D)
	}
	return bson.D{{Key: "$or", Value: clauses}}
}

func (s *Store) findTempJobIDs(ctx context.Context, filter bson.D) ([]bson.ObjectID, error) {
	cursor, err := s.dest().Find(ctx, filter, options.Find().SetProjection(bson.D{{Key: "_id", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var ids []bson.ObjectID
	for cursor.Next(ctx) {
		var doc struct {
			ID bson.ObjectID `bson:"_id"`
		}
		if err := cursor.Decode(&doc); err != nil {
			return nil, err
		}
		ids = append(ids, doc.ID)
	}
	return ids, cursor.Err()
}

func (s *Store) deleteTempJobsByFilter(ctx context.Context, filter bson.D, ids []bson.ObjectID) ([]string, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	if _, err := s.dest().DeleteMany(ctx, filter); err != nil {
		return nil, err
	}
	out := make([]string, len(ids))
	for i, id := range ids {
		out[i] = id.Hex()
	}
	return out, nil
}

var searchRecordKeys = []string{
	"job", "tempJobId", "applyLink", "analyzedAt", "model", "createdBy", "source", "listingStatus",
}

var searchJobKeys = []string{
	"id", "title", "company", "companyId", "location", "workplace", "pay", "equity", "seniority",
	"employment", "postedHoursAgo", "source", "visa", "applicants", "team", "skills", "summary",
	"responsibilities", "requirements", "benefits", "description", "screeningQuestions",
}

var payKeys = []string{"min", "max", "currency", "period", "estimated"}

var companyResearchKeys = []string{"company", "sources"}

var companyWriteKeys = []string{
	"name", "url", "logo", "tagline", "about", "industry", "size", "founded", "replyDays",
	"headquarters", "companyType", "locations", "specialties", "mission", "values", "benefitCategories",
}

// ParseSubmittedSearchRecord decodes and validates an external job analysis body.
func ParseSubmittedSearchRecord(raw []byte) (SearchRecord, error) {
	var probe map[string]json.RawMessage
	if err := json.Unmarshal(raw, &probe); err != nil {
		return SearchRecord{}, fmt.Errorf("%w: invalid JSON", ErrInvalidInput)
	}
	if err := rejectUnknownKeys(probe, searchRecordKeys); err != nil {
		return SearchRecord{}, err
	}
	jobRaw, ok := probe["job"]
	if !ok {
		return SearchRecord{}, fmt.Errorf("%w: job is required", ErrInvalidInput)
	}
	if err := validateSearchJobJSON(jobRaw); err != nil {
		return SearchRecord{}, err
	}
	var record SearchRecord
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&record); err != nil {
		return SearchRecord{}, fmt.Errorf("%w: %v", ErrInvalidInput, err)
	}
	if err := validateSubmittedSearchRecord(record); err != nil {
		return SearchRecord{}, err
	}
	return record, nil
}

// ParseSubmittedCompanyResearch decodes and validates an external company analysis body.
func ParseSubmittedCompanyResearch(raw []byte) (CompanyResearch, error) {
	var probe map[string]json.RawMessage
	if err := json.Unmarshal(raw, &probe); err != nil {
		return CompanyResearch{}, fmt.Errorf("%w: invalid JSON", ErrInvalidInput)
	}
	if err := rejectUnknownKeys(probe, companyResearchKeys); err != nil {
		return CompanyResearch{}, err
	}
	companyRaw, ok := probe["company"]
	if !ok {
		return CompanyResearch{}, fmt.Errorf("%w: company is required", ErrInvalidInput)
	}
	if err := validateCompanyWriteJSON(companyRaw); err != nil {
		return CompanyResearch{}, err
	}
	var input CompanyResearch
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&input); err != nil {
		return CompanyResearch{}, fmt.Errorf("%w: %v", ErrInvalidInput, err)
	}
	return input, validateSubmittedCompanyResearch(input)
}

func validateSubmittedCompanyResearch(input CompanyResearch) error {
	if _, err := overridesFrom(input.Company); err != nil {
		return err
	}
	if input.Sources == nil {
		return fmt.Errorf("%w: sources is required", ErrInvalidInput)
	}
	for _, source := range input.Sources {
		if strings.TrimSpace(source) == "" {
			return fmt.Errorf("%w: sources cannot contain blank entries", ErrInvalidInput)
		}
	}
	return nil
}

func validateSubmittedSearchRecord(record SearchRecord) error {
	if strings.TrimSpace(record.TempJobID) == "" {
		return fmt.Errorf("%w: tempJobId is required", ErrInvalidInput)
	}
	if strings.TrimSpace(record.Model) == "" {
		return fmt.Errorf("%w: model is required", ErrInvalidInput)
	}
	if record.AnalyzedAt.IsZero() {
		return fmt.Errorf("%w: analyzedAt is required", ErrInvalidInput)
	}
	return validateSearchJobFields(record.Job)
}

func validateSearchJobJSON(raw json.RawMessage) error {
	var probe map[string]json.RawMessage
	if err := json.Unmarshal(raw, &probe); err != nil {
		return fmt.Errorf("%w: invalid job", ErrInvalidInput)
	}
	if err := rejectUnknownKeys(probe, searchJobKeys); err != nil {
		return err
	}
	payRaw, ok := probe["pay"]
	if !ok {
		return fmt.Errorf("%w: job.pay is required", ErrInvalidInput)
	}
	var payProbe map[string]json.RawMessage
	if err := json.Unmarshal(payRaw, &payProbe); err != nil {
		return fmt.Errorf("%w: invalid job.pay", ErrInvalidInput)
	}
	return rejectUnknownKeys(payProbe, payKeys)
}

func validateCompanyWriteJSON(raw json.RawMessage) error {
	var probe map[string]json.RawMessage
	if err := json.Unmarshal(raw, &probe); err != nil {
		return fmt.Errorf("%w: invalid company", ErrInvalidInput)
	}
	return rejectUnknownKeys(probe, companyWriteKeys)
}

func rejectUnknownKeys(probe map[string]json.RawMessage, allowed []string) error {
	for key := range probe {
		if !slices.Contains(allowed, key) {
			return fmt.Errorf("%w: unknown field %q", ErrInvalidInput, key)
		}
	}
	return nil
}

func validateSearchJobFields(job SearchJob) error {
	if strings.TrimSpace(job.ID) == "" {
		return fmt.Errorf("%w: job.id is required", ErrInvalidInput)
	}
	if strings.TrimSpace(job.Title) == "" {
		return fmt.Errorf("%w: job.title is required", ErrInvalidInput)
	}
	if strings.TrimSpace(job.Company) == "" {
		return fmt.Errorf("%w: job.company is required", ErrInvalidInput)
	}
	if strings.TrimSpace(job.Description) == "" {
		return ErrMissingDescription
	}
	if !oneOfAllowed(job.Workplace, []string{workplaceRemote, workplaceHybrid, workplaceOnsite}) {
		return fmt.Errorf("%w: job.workplace is invalid", ErrInvalidInput)
	}
	if !oneOfAllowed(job.Seniority, []string{seniorityJunior, seniorityMiddle, senioritySenior, seniorityLeader, seniorityManager}) {
		return fmt.Errorf("%w: job.seniority is invalid", ErrInvalidInput)
	}
	if !oneOfAllowed(job.Employment, []string{employmentFullTime, employmentContract, employmentPartTime}) {
		return fmt.Errorf("%w: job.employment is invalid", ErrInvalidInput)
	}
	pay := sanitizePay(job.Pay)
	if pay.Period != payYear && pay.Period != payHour {
		return fmt.Errorf("%w: job.pay.period is invalid", ErrInvalidInput)
	}
	if len(pay.Currency) != 3 {
		return fmt.Errorf("%w: job.pay.currency is invalid", ErrInvalidInput)
	}
	if job.Skills == nil || job.Responsibilities == nil || job.Requirements == nil || job.Benefits == nil {
		return fmt.Errorf("%w: job list fields must be arrays", ErrInvalidInput)
	}
	if _, err := NormalizeScreeningQuestions(job.ScreeningQuestions); err != nil {
		return err
	}
	return nil
}

func oneOfAllowed(value string, allowed []string) bool {
	for _, option := range allowed {
		if value == option {
			return true
		}
	}
	return false
}
